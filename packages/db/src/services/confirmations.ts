import {
  buildTemplate,
  checkConfirmationRing,
  checkRepeatedIncidents,
  checkSameClientRepeat,
  decideReview,
  formatDayMonthHarare,
  isNearNextLevel,
  t,
  type ClientActionResult,
  type Lang,
} from '@sp/core';
import { hashToken, newToken } from '@sp/adapters';
import type { ServiceContext } from './context';
import { event } from './artisans';
import { raiseFlag } from './fraud';
import { checkClientPhone, setJobStatus, upsertClient } from './jobs';
import { evaluateArtisan, recalculateLevel, withNudge } from './levels';
import { notify, sendToPhone } from './outbound';
import { localized } from './reference';

const HOUR = 3600_000;
export const MAX_REMINDERS = 3;

export const ratingLink = (ctx: ServiceContext, token: string) => `${ctx.publicBaseUrl}/c/${token}`;

async function clientName(ctx: ServiceContext, jobId: string) {
  const j = await ctx.prisma.job.findUnique({ where: { id: jobId }, select: { clientNameEnc: true } });
  return j?.clientNameEnc ? ctx.adapters.crypto.decrypt(j.clientNameEnc) : '';
}

async function createAgentTask(ctx: ServiceContext, kind: string, jobId: string, artisanId: string, note: string) {
  const open = await ctx.prisma.agentTask.findFirst({ where: { kind, jobId, status: 'open' } });
  if (!open) await ctx.prisma.agentTask.create({ data: { kind, jobId, artisanId, note, createdAt: ctx.now() } });
}

function confirmationTemplate(ctx: ServiceContext, kind: 'client_job_confirmation' | 'client_job_reminder', lang: Lang, p: { firstName: string; jobType: string; date: Date; token: string; confirmationId: string }) {
  return buildTemplate(kind, lang, [p.firstName, p.jobType, formatDayMonthHarare(p.date), ratingLink(ctx, p.token)], p.confirmationId);
}

/** SPEC 4.3: hashed single-use token (7 days) and the WhatsApp template with quick-reply buttons. */
export async function sendConfirmation(ctx: ServiceContext, jobId: string) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { client: true, artisan: true, jobType: true, confirmation: true } });
  if (job.status !== 'submitted' || !job.client) return;
  if (job.agentAssisted && !job.artisanConfirmedAt) return;
  const { params: config } = await ctx.config();
  const token = newToken();
  const expires = new Date(ctx.now().getTime() + config.confirmation.expiryDays * 24 * HOUR);
  const conf = job.confirmation
    ? await ctx.prisma.confirmation.update({ where: { id: job.confirmation.id }, data: { tokenHash: hashToken(token), tokenExpiresAt: expires, clientId: job.client.id, devToken: ctx.devTools ? token : null } })
    : await ctx.prisma.confirmation.create({
        data: { jobId, clientId: job.client.id, channel: 'whatsapp', tokenHash: hashToken(token), tokenExpiresAt: expires, devToken: ctx.devTools ? token : null },
      });
  await setJobStatus(ctx, jobId, 'awaiting_client', 'confirmation_sent');

  const name = await clientName(ctx, jobId);
  if (job.client.optedOut || job.client.blocked) {
    await createAgentTask(ctx, 'client_followup', jobId, job.artisanId, 'Client has stopped messages. Call them to confirm the job.');
    await notify(ctx, { kind: 'artisan', id: job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.client_opted_out', { client: name, ref: job.ref }) }], { purpose: 'client_opted_out', relatedEntity: 'job', relatedId: jobId, ref: job.ref });
  } else {
    const lang = job.client.language;
    const phone = ctx.adapters.crypto.decrypt(job.client.phoneEnc);
    const msg = confirmationTemplate(ctx, 'client_job_confirmation', lang, {
      firstName: job.artisan.firstName,
      jobType: localized(job.jobType.name)[lang],
      date: job.jobDate ?? job.createdAt,
      token,
      confirmationId: conf.id,
    });
    const res = await sendToPhone(ctx, phone, [msg], { purpose: 'client_confirmation', relatedEntity: 'confirmation', relatedId: conf.id });
    if (res.undeliverable) {
      await markUndeliverable(ctx, conf.id);
    } else {
      await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { sentAt: ctx.now(), deliveryStatus: 'sent' } });
    }
  }
  for (const [i, h] of config.confirmation.reminderHours.entries()) {
    await ctx.queue.enqueue('confirmation.remind', { confirmationId: conf.id, n: i + 1 }, { delayMs: h * HOUR, jobId: `remind:${conf.id}:${i + 1}` });
  }
  await ctx.queue.enqueue('confirmation.expire', { confirmationId: conf.id }, { delayMs: config.confirmation.expiryDays * 24 * HOUR, jobId: `expire:${conf.id}` });
}

/** Client not on WhatsApp → field-agent phone follow-up (SPEC 4.3). */
export async function markUndeliverable(ctx: ServiceContext, confirmationId: string) {
  const conf = await ctx.prisma.confirmation.update({ where: { id: confirmationId }, data: { deliveryStatus: 'undeliverable' }, include: { job: true } });
  await createAgentTask(ctx, 'client_followup', conf.jobId, conf.job.artisanId, 'Client is not on WhatsApp. Call them to confirm the job.');
  const name = await clientName(ctx, conf.jobId);
  await notify(ctx, { kind: 'artisan', id: conf.job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.undeliverable', { client: name, ref: conf.job.ref }) }], {
    purpose: 'client_undeliverable',
    relatedEntity: 'job',
    relatedId: conf.jobId,
    ref: conf.job.ref,
  });
}

export async function sendReminder(ctx: ServiceContext, confirmationId: string, manual = false): Promise<'sent' | 'limit' | 'skipped'> {
  const conf = await ctx.prisma.confirmation.findUnique({ where: { id: confirmationId }, include: { job: { include: { artisan: true, jobType: true } }, client: true } });
  if (!conf || conf.response || conf.job.status !== 'awaiting_client' || conf.client.optedOut) return 'skipped';
  if (conf.deliveryStatus === 'undeliverable') return 'skipped';
  if (conf.remindersSent >= MAX_REMINDERS) return 'limit';
  // Reminders reuse a fresh token so the link in the newest message always works.
  const token = newToken();
  await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { tokenHash: hashToken(token), remindersSent: { increment: 1 }, devToken: ctx.devTools ? token : null } });
  const lang = conf.client.language;
  const msg = confirmationTemplate(ctx, 'client_job_reminder', lang, {
    firstName: conf.job.artisan.firstName,
    jobType: localized(conf.job.jobType.name)[lang],
    date: conf.job.jobDate ?? conf.job.createdAt,
    token,
    confirmationId: conf.id,
  });
  const res = await sendToPhone(ctx, ctx.adapters.crypto.decrypt(conf.client.phoneEnc), [msg], { purpose: manual ? 'client_reminder_manual' : 'client_reminder', relatedEntity: 'confirmation', relatedId: conf.id });
  if (res.undeliverable) await markUndeliverable(ctx, conf.id);
  return 'sent';
}

export async function remindByJob(ctx: ServiceContext, jobId: string) {
  const conf = await ctx.prisma.confirmation.findUnique({ where: { jobId } });
  if (!conf) return 'limit' as const;
  const r = await sendReminder(ctx, conf.id, true);
  return r === 'sent' ? ('sent' as const) : ('limit' as const);
}

export async function expireConfirmation(ctx: ServiceContext, confirmationId: string) {
  const conf = await ctx.prisma.confirmation.findUnique({ where: { id: confirmationId }, include: { job: true } });
  if (!conf || conf.response || conf.job.status !== 'awaiting_client') return;
  await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { response: 'expired' } });
  await setJobStatus(ctx, conf.jobId, 'client_expired', 'client_no_answer');
  await createAgentTask(ctx, 'client_followup', conf.jobId, conf.job.artisanId, 'Client did not answer within 7 days. Call them and record the outcome.');
  const name = await clientName(ctx, conf.jobId);
  await notify(ctx, { kind: 'artisan', id: conf.job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.expired', { client: name, ref: conf.job.ref }) }], {
    purpose: 'client_expired',
    relatedEntity: 'job',
    relatedId: conf.jobId,
    ref: conf.job.ref,
  });
  await recalculateLevel(ctx, conf.job.artisanId, 'client_expired');
}

/** Client confirmed (button, web page or agent phone follow-up). */
export async function confirmJob(ctx: ServiceContext, jobId: string, by: { kind: 'client' } | { kind: 'agent'; agentId: string }, rating?: { rating?: number | null; comment?: string | null }) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { confirmation: true } });
  const before = await evaluateArtisan(ctx, job.artisanId);
  const trigger = by.kind === 'agent' ? 'agent_follow_up' : 'client_confirmed';
  await setJobStatus(ctx, jobId, 'client_confirmed', trigger);
  await ctx.prisma.confirmation.update({
    where: { jobId },
    data: {
      response: 'confirmed',
      respondedAt: ctx.now(),
      ...(rating?.rating ? { rating: rating.rating } : {}),
      ...(rating?.comment ? { comment: rating.comment } : {}),
      ...(by.kind === 'agent' ? { recordedByAgentId: by.agentId, channel: 'agent' } : {}),
    },
  });
  for (const id of [`remind:${job.confirmation?.id}:1`, `remind:${job.confirmation?.id}:2`, `expire:${job.confirmation?.id}`]) await ctx.queue.cancel(id);

  // Fraud rules that need confirmation history (SPEC 6).
  const { params: config } = await ctx.config();
  if (job.clientId) {
    const prior = await ctx.prisma.confirmation.findMany({
      where: { clientId: job.clientId, response: 'confirmed', jobId: { not: jobId }, job: { artisanId: job.artisanId } },
      select: { respondedAt: true },
    });
    const repeat = checkSameClientRepeat({ priorConfirmations: prior.map((p) => p.respondedAt!).filter(Boolean), now: ctx.now() }, config);
    if (repeat) await raiseFlag(ctx, repeat, jobId);
    const all = await ctx.prisma.confirmation.findMany({ where: { clientId: job.clientId, response: 'confirmed' }, select: { respondedAt: true, job: { select: { artisanId: true, id: true } } } });
    const ring = checkConfirmationRing({ confirmations: all.map((c) => ({ artisanId: c.job.artisanId, at: c.respondedAt! })), now: ctx.now() }, config);
    if (ring) {
      await raiseFlag(ctx, ring, job.clientId);
      for (const c of all) await raiseFlag(ctx, { ...ring, entity: 'job' }, c.job.id);
    }
  }

  // Review sampling (SPEC 5).
  const fresh = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { status: true, flagRules: true, reviewRequired: true } });
  if (fresh.status === 'client_confirmed') {
    const lastDispute = await ctx.prisma.job.findFirst({ where: { artisanId: job.artisanId, disputed: true }, orderBy: { statusChangedAt: 'desc' }, select: { statusChangedAt: true } });
    const decision = decideReview(
      {
        job: { disputed: false, flagged: fresh.flagRules.length > 0 || fresh.reviewRequired },
        priorCountedJobs: before.countedIds.size,
        lastDisputeAt: lastDispute?.statusChangedAt ?? null,
        nearNextLevel: isNearNextLevel(before.result),
        now: ctx.now(),
        random: ctx.random,
      },
      config,
    );
    if (decision.review) {
      await setJobStatus(ctx, jobId, 'under_review', 'selected_for_review', { reviewRequired: true, reviewReason: decision.reason, queuedForReviewAt: ctx.now() });
    } else {
      await ctx.prisma.job.update({ where: { id: jobId }, data: { reviewReason: decision.reason } });
    }
  }

  const standing = await recalculateLevel(ctx, job.artisanId, 'client_confirmed', { notify: true });
  const name = await clientName(ctx, jobId);
  const next = standing?.result.next ?? null;
  if (!standing?.levelChanged) {
    await notify(
      ctx,
      { kind: 'artisan', id: job.artisanId },
      (l) => {
        const lines = [withNudge(l, 'notify.confirmed', { client: name, ref: job.ref }, next)];
        return [{ kind: 'text', text: lines.join('\n') }];
      },
      { purpose: 'job_confirmed', relatedEntity: 'job', relatedId: jobId, ref: job.ref },
    );
  }
  await event(ctx, 'client_confirmed', job.artisanId, { via: by.kind });
}

export async function disputeJob(ctx: ServiceContext, jobId: string, by: { kind: 'client' } | { kind: 'agent'; agentId: string }, comment?: string | null) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  await setJobStatus(ctx, jobId, 'client_disputed', by.kind === 'agent' ? 'agent_follow_up' : 'client_disputed', { disputed: true });
  await ctx.prisma.confirmation.update({
    where: { jobId },
    data: { response: 'disputed', respondedAt: ctx.now(), ...(comment ? { comment } : {}), ...(by.kind === 'agent' ? { recordedByAgentId: by.agentId, channel: 'agent' } : {}) },
  });
  await setJobStatus(ctx, jobId, 'under_review', 'selected_for_review', { reviewRequired: true, reviewReason: 'disputed', queuedForReviewAt: ctx.now() });
  const { params: config } = await ctx.config();
  const incidents = await ctx.prisma.job.findMany({ where: { artisanId: job.artisanId, OR: [{ disputed: true }, { status: 'rejected' }] }, select: { statusChangedAt: true } });
  const freeze = checkRepeatedIncidents({ incidents: incidents.map((i) => i.statusChangedAt), now: ctx.now() }, config);
  if (freeze) {
    await raiseFlag(ctx, freeze, job.artisanId);
    await ctx.prisma.artisan.update({ where: { id: job.artisanId }, data: { levelFrozen: true } });
  }
  const name = await clientName(ctx, jobId);
  await notify(ctx, { kind: 'artisan', id: job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.disputed', { client: name, ref: job.ref }) }], {
    purpose: 'job_disputed',
    relatedEntity: 'job',
    relatedId: jobId,
    ref: job.ref,
  });
  await recalculateLevel(ctx, job.artisanId, 'client_disputed');
  await event(ctx, 'client_disputed', job.artisanId, { via: by.kind });
}

/** WhatsApp quick-reply buttons from the client template. */
export async function clientRespond(ctx: ServiceContext, input: { phone: string; confirmationId: string; action: 'yes' | 'no' | 'stop' }): Promise<ClientActionResult> {
  const conf = await ctx.prisma.confirmation.findUnique({ where: { id: input.confirmationId }, include: { client: true, job: true } });
  if (!conf || conf.client.phoneHash !== ctx.adapters.crypto.phoneHash(input.phone)) return { result: 'not_found' };
  const lang = conf.client.language;
  if (input.action === 'stop') {
    await ctx.prisma.client.update({ where: { id: conf.clientId }, data: { optedOut: true, optedOutAt: ctx.now() } });
    if (!conf.response && conf.job.status === 'awaiting_client') {
      await createAgentTask(ctx, 'client_followup', conf.jobId, conf.job.artisanId, 'Client stopped messages before answering. Call them to confirm the job.');
    }
    return { result: 'stopped', lang };
  }
  if (conf.response === 'expired' || conf.job.status === 'client_expired') return { result: 'expired', lang };
  if (conf.response) return { result: 'already', lang };
  if (input.action === 'yes') {
    // A fresh token for the rating page, so the link in our reply works even after reminders rotated it.
    const token = newToken();
    await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { tokenHash: hashToken(token), devToken: ctx.devTools ? token : null } });
    await confirmJob(ctx, conf.jobId, { kind: 'client' });
    return { result: 'confirmed', lang, link: ratingLink(ctx, token) };
  }
  await disputeJob(ctx, conf.jobId, { kind: 'client' });
  return { result: 'disputed', lang };
}

export type ConfirmationPageState = 'open' | 'rate' | 'used' | 'expired' | 'invalid';

/** View model for /c/[token]. Shows only what the client needs: never the artisan's other jobs or private data. */
export async function getConfirmationPage(ctx: ServiceContext, token: string) {
  const conf = await ctx.prisma.confirmation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { client: true, job: { include: { artisan: true, jobType: true, area: true, media: { where: { kind: { in: ['photo_before', 'photo_after'] }, publicKey: { not: null } }, orderBy: [{ kind: 'desc' }, { sortOrder: 'asc' }] } } } },
  });
  if (!conf) return { state: 'invalid' as ConfirmationPageState };
  let state: ConfirmationPageState = 'open';
  if (conf.tokenUsedAt) state = 'used';
  else if (conf.tokenExpiresAt < ctx.now() || conf.response === 'expired' || conf.job.status === 'client_expired') state = 'expired';
  else if (conf.response === 'confirmed') state = conf.rating ? 'used' : 'rate';
  else if (conf.response === 'disputed') state = 'used';
  const { job } = conf;
  return {
    state,
    lang: conf.client.language,
    artisan: { displayName: job.artisan.displayName, firstName: job.artisan.firstName, passportCode: job.artisan.passportCode, public: job.artisan.status !== 'deleted' },
    job: {
      ref: job.ref,
      jobType: localized(job.jobType.name),
      date: (job.jobDate ?? job.createdAt).toISOString(),
      area: job.area?.name ?? null,
      summary: (job.artisanSummary as { summary?: string } | null)?.summary ?? (job.aiSummary as { summary?: string } | null)?.summary ?? null,
      photos: job.media.map((m) => ({ id: m.id, url: ctx.adapters.storage.publicUrl(m.publicKey!), thumb: m.thumbKey ? ctx.adapters.storage.publicUrl(m.thumbKey) : null, kind: m.kind, width: m.width, height: m.height })),
    },
    response: conf.response,
    rating: conf.rating,
  };
}

/** POST /c/{token}: confirm or dispute, with optional rating and comment. Single use. */
export async function submitConfirmationPage(ctx: ServiceContext, token: string, input: { response: 'confirmed' | 'disputed' | 'stop'; rating?: number | null; comment?: string | null }) {
  const page = await getConfirmationPage(ctx, token);
  if (page.state === 'invalid' || page.state === 'expired' || page.state === 'used') return { ok: false as const, state: page.state };
  const conf = await ctx.prisma.confirmation.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  const rating = input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null;
  const comment = input.comment?.trim().slice(0, 1000) || null;
  if (input.response === 'stop') {
    await ctx.prisma.client.update({ where: { id: conf.clientId }, data: { optedOut: true, optedOutAt: ctx.now() } });
    return { ok: true as const, state: 'stopped' as const };
  }
  await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { tokenUsedAt: ctx.now() } });
  if (page.state === 'rate') {
    await ctx.prisma.confirmation.update({ where: { id: conf.id }, data: { rating, comment } });
    const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: conf.jobId } });
    await recalculateLevel(ctx, job.artisanId, 'client_rated', { notify: true });
    if (rating) {
      const name = await clientName(ctx, conf.jobId);
      await notify(ctx, { kind: 'artisan', id: job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.rated', { client: name, ref: job.ref, rating }) }], { purpose: 'job_rated', relatedEntity: 'job', relatedId: job.id, ref: job.ref });
    }
    return { ok: true as const, state: 'confirmed' as const };
  }
  if (input.response === 'confirmed') {
    await confirmJob(ctx, conf.jobId, { kind: 'client' }, { rating, comment });
    return { ok: true as const, state: 'confirmed' as const };
  }
  await disputeJob(ctx, conf.jobId, { kind: 'client' }, comment);
  return { ok: true as const, state: 'disputed' as const };
}

/** Artisan changes the client number before confirmation (SPEC 8 "Waiting for clients"). */
export async function changeClientPhone(ctx: ServiceContext, jobId: string, phone: string) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { artisan: true, confirmation: true } });
  const check = await checkClientPhone(ctx, { artisanId: job.artisanId, phone });
  if (check !== 'ok') return check;
  if (job.status !== 'awaiting_client' || job.confirmation?.response) return 'ok' as const;
  const name = job.clientNameEnc ? ctx.adapters.crypto.decrypt(job.clientNameEnc) : '';
  const client = await upsertClient(ctx, phone, name, job.artisanId, job.artisan.language);
  if (job.confirmation) {
    for (const id of [`remind:${job.confirmation.id}:1`, `remind:${job.confirmation.id}:2`, `expire:${job.confirmation.id}`]) await ctx.queue.cancel(id);
    await ctx.prisma.confirmation.delete({ where: { id: job.confirmation.id } });
  }
  await ctx.prisma.job.update({ where: { id: jobId }, data: { clientId: client.id, status: 'submitted', statusChangedAt: ctx.now() } });
  await sendConfirmation(ctx, jobId);
  return 'ok' as const;
}

/** Field agent records the outcome of a phone follow-up (SPEC 4.3, 4.10). */
export async function recordAgentFollowUp(ctx: ServiceContext, jobId: string, agentId: string, outcome: 'confirmed' | 'disputed' | 'not_reached' | 'closed', rating?: number | null) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (outcome === 'confirmed') {
    if (job.status === 'awaiting_client' || job.status === 'client_expired') await confirmJob(ctx, jobId, { kind: 'agent', agentId }, { rating: rating ?? null });
  } else if (outcome === 'disputed') {
    if (job.status === 'awaiting_client') await disputeJob(ctx, jobId, { kind: 'agent', agentId });
  } else if (outcome === 'closed' && job.status === 'client_expired') {
    await setJobStatus(ctx, jobId, 'closed', 'agent_follow_up');
    await recalculateLevel(ctx, job.artisanId, 'closed');
  }
  await ctx.prisma.agentTask.updateMany({ where: { jobId, kind: 'client_followup', status: 'open' }, data: { status: outcome === 'not_reached' ? 'open' : 'done', completedAt: outcome === 'not_reached' ? null : ctx.now(), note: outcome === 'not_reached' ? 'Not reached — try again.' : undefined } });
  await ctx.prisma.auditLog.create({ data: { actorId: agentId, action: `agent.followup.${outcome}`, entity: 'job', entityId: jobId, at: ctx.now() } });
}
