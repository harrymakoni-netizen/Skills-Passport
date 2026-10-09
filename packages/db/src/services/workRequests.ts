import { buildTemplate, clip } from '@sp/core';
import type { ServiceContext } from './context';
import { event } from './artisans';
import { createDraftJob, upsertClient } from './jobs';
import { notify } from './outbound';

const DAY = 86400_000;

export async function listOpenWorkRequests(ctx: ServiceContext, artisanId: string) {
  const rows = await ctx.prisma.workRequest.findMany({ where: { artisanId, status: 'sent' }, include: { buyer: true, area: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => ({ id: r.id, buyerName: r.buyer.orgName, area: r.area.name, dates: r.preferredDates, description: r.description }));
}

/** Buyer sends a request (SPEC 4.7). Blocked/reported clients can't send requests. */
export async function createWorkRequest(ctx: ServiceContext, input: { buyerId: string; artisanCode: string; description: string; areaId: string; preferredDates: string }) {
  const buyer = await ctx.prisma.buyer.findUniqueOrThrow({ where: { id: input.buyerId } });
  const asClient = await ctx.prisma.client.findUnique({ where: { phoneHash: buyer.contactPhoneHash } });
  if (asClient?.blocked) throw Object.assign(new Error('This account cannot send work requests.'), { status: 403 });
  const artisan = await ctx.prisma.artisan.findUnique({ where: { passportCode: input.artisanCode } });
  if (!artisan || artisan.status !== 'active') throw Object.assign(new Error('Artisan not found'), { status: 404 });
  if (asClient) {
    const reported = await ctx.prisma.clientReport.findFirst({ where: { clientId: asClient.id, artisanId: artisan.id, status: { not: 'dismissed' } } });
    if (reported) throw Object.assign(new Error('This artisan is not accepting requests from you.'), { status: 403 });
  }
  const wr = await ctx.prisma.workRequest.create({
    data: { buyerId: buyer.id, artisanId: artisan.id, description: input.description.slice(0, 500), areaId: input.areaId, preferredDates: input.preferredDates.slice(0, 120), createdAt: ctx.now() },
    include: { area: true },
  });
  await notify(
    ctx,
    { kind: 'artisan', id: artisan.id },
    (l) => [buildTemplate('artisan_work_request', l, [buyer.orgName, wr.area.name, clip(wr.description, 300)], wr.id)],
    { purpose: 'work_request', relatedEntity: 'work_request', relatedId: wr.id },
  );
  await event(ctx, 'work_request_sent', artisan.id);
  return wr;
}

export async function respondWorkRequest(ctx: ServiceContext, input: { artisanId: string; requestId: string; accept: boolean }) {
  const wr = await ctx.prisma.workRequest.findUnique({ where: { id: input.requestId }, include: { buyer: true, artisan: { include: { pii: true } } } });
  if (!wr || wr.artisanId !== input.artisanId || wr.status !== 'sent') return { ok: false as const };
  await ctx.prisma.workRequest.update({
    where: { id: wr.id },
    data: { status: input.accept ? 'accepted' : 'declined', respondedAt: ctx.now(), followUpAt: input.accept ? new Date(ctx.now().getTime() + 14 * DAY) : null },
  });
  if (!input.accept) return { ok: true as const };
  const { params: config } = await ctx.config();
  await ctx.queue.enqueue('workrequest.followup', { workRequestId: wr.id }, { delayMs: config.workRequests.followUpDays * DAY, jobId: `wrfollow:${wr.id}` });
  await event(ctx, 'work_request_accepted', wr.artisanId);
  const { crypto } = ctx.adapters;
  return { ok: true as const, contactName: crypto.decrypt(wr.buyer.contactNameEnc), contactPhone: crypto.decrypt(wr.buyer.contactPhoneEnc) };
}

/** 14 days after acceptance both sides are asked whether the job happened (SPEC 4.7 step 4). */
export async function workRequestFollowUp(ctx: ServiceContext, workRequestId: string) {
  const wr = await ctx.prisma.workRequest.findUnique({ where: { id: workRequestId }, include: { buyer: true, artisan: true } });
  if (!wr || wr.status !== 'accepted' || wr.outcome !== 'unknown') return;
  await notify(ctx, { kind: 'artisan', id: wr.artisanId }, (l) => [buildTemplate('hire_follow_up', l, [wr.buyer.orgName, clip(wr.description, 120)], wr.id)], {
    purpose: 'hire_follow_up',
    relatedEntity: 'work_request',
    relatedId: wr.id,
  });
  await notify(ctx, { kind: 'buyer', id: wr.buyerId }, (l) => [buildTemplate('hire_follow_up', l, [wr.artisan.displayName, clip(wr.description, 120)], wr.id)], {
    purpose: 'hire_follow_up',
    relatedEntity: 'work_request',
    relatedId: wr.id,
  });
}

export async function recordHireOutcome(ctx: ServiceContext, input: { phone: string; requestId: string; happened: boolean }) {
  const wr = await ctx.prisma.workRequest.findUnique({ where: { id: input.requestId }, include: { buyer: true, artisan: { include: { pii: true } } } });
  if (!wr) return null;
  const hash = ctx.adapters.crypto.phoneHash(input.phone);
  const outcome = input.happened ? 'hired' : 'not_hired';
  if (wr.artisan.pii?.phoneHash === hash) {
    await ctx.prisma.workRequest.update({ where: { id: wr.id }, data: { outcome } });
    if (input.happened) await event(ctx, 'hire_reported', wr.artisanId, { by: 'artisan' });
    return { canLog: input.happened && !wr.jobId, buyerName: wr.buyer.orgName };
  }
  if (wr.buyer.contactPhoneHash === hash) {
    await ctx.prisma.workRequest.update({ where: { id: wr.id }, data: { buyerOutcome: outcome } });
    return { canLog: false, buyerName: wr.buyer.orgName };
  }
  return null;
}

/**
 * "A completed hire can be logged as a job in one tap, with the buyer as the client" (SPEC 4.7). The buyer still
 * confirms it — through the same client confirmation flow — unless they already reported the hire as done, in which
 * case their report counts as the confirmation.
 */
export async function logHireAsJob(ctx: ServiceContext, input: { artisanId: string; requestId: string }) {
  const wr = await ctx.prisma.workRequest.findUnique({ where: { id: input.requestId }, include: { buyer: true, artisan: { include: { trades: { orderBy: { primary: 'desc' } } } } } });
  if (!wr || wr.artisanId !== input.artisanId || wr.jobId || wr.outcome !== 'hired') return null;
  const tradeId = wr.artisan.trades[0]!.tradeId;
  const jobType = await ctx.prisma.jobType.findFirstOrThrow({ where: { tradeId, active: true }, orderBy: { sortOrder: 'asc' } });
  const { jobId, ref } = await createDraftJob(ctx, { artisanId: wr.artisanId, tradeId, jobTypeId: jobType.id });
  const { crypto } = ctx.adapters;
  const name = crypto.decrypt(wr.buyer.contactNameEnc);
  const client = await upsertClient(ctx, crypto.decrypt(wr.buyer.contactPhoneEnc), name, wr.artisanId, 'en');
  await ctx.prisma.job.update({
    where: { id: jobId },
    data: { status: 'submitted', submittedAt: ctx.now(), clientId: client.id, clientNameEnc: crypto.encrypt(name), jobDate: wr.respondedAt ?? ctx.now(), areaId: wr.areaId, notes: [wr.description] },
  });
  await ctx.prisma.workRequest.update({ where: { id: wr.id }, data: { jobId } });
  await ctx.queue.enqueue('confirmation.send', { jobId }, { jobId: `confirm:${jobId}` });
  await ctx.queue.enqueue('ai.process', { jobId });
  return { ref };
}
