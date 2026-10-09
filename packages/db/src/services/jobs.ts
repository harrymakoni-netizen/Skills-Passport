import {
  checkClientIsRegisteredPhone,
  checkLocation,
  checkRecentlyRegisteredClient,
  makeJobRef,
  transition,
  type ClientPhoneCheckResult,
  type JobStatus,
  type SubmitJobInput,
  type TransitionTrigger,
} from '@sp/core';
import type { MediaKind } from '@prisma/client';
import type { ServiceContext } from './context';
import { event } from './artisans';
import { raiseFlag } from './fraud';

/** Applies a status change through the core state machine (throws on illegal transitions). */
export async function setJobStatus(ctx: ServiceContext, jobId: string, to: JobStatus, trigger: TransitionTrigger, extra: Record<string, unknown> = {}) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
  transition(job.status, to, trigger);
  return ctx.prisma.job.update({ where: { id: jobId }, data: { status: to, statusChangedAt: ctx.now(), ...extra } });
}

async function uniqueRef(ctx: ServiceContext): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const ref = makeJobRef(ctx.random);
    if (!(await ctx.prisma.job.findUnique({ where: { ref }, select: { id: true } }))) return ref;
  }
  throw new Error('Could not allocate a job reference');
}

export async function createDraftJob(ctx: ServiceContext, input: { artisanId: string; tradeId: string; jobTypeId: string; agentId?: string }) {
  const job = await ctx.prisma.job.create({
    data: {
      ref: await uniqueRef(ctx),
      artisanId: input.artisanId,
      tradeId: input.tradeId,
      jobTypeId: input.jobTypeId,
      status: 'draft',
      agentAssisted: Boolean(input.agentId),
      agentId: input.agentId ?? null,
      createdAt: ctx.now(),
      statusChangedAt: ctx.now(),
    },
  });
  return { jobId: job.id, ref: job.ref };
}

/** Records a media reference and downloads it immediately (WhatsApp media URLs are short-lived — SPEC 8). */
export async function attachMedia(ctx: ServiceContext, input: { jobId: string; kind: MediaKind; providerMediaId?: string; originalKey?: string; mimeType: string; durationSec?: number }) {
  const count = await ctx.prisma.jobMedia.count({ where: { jobId: input.jobId, kind: input.kind } });
  const m = await ctx.prisma.jobMedia.create({
    data: {
      jobId: input.jobId,
      kind: input.kind,
      providerMediaId: input.providerMediaId ?? null,
      originalKey: input.originalKey ?? null,
      mimeType: input.mimeType,
      durationSec: input.durationSec ?? null,
      sortOrder: count,
      createdAt: ctx.now(),
    },
  });
  await ctx.queue.enqueue('media.process', { mediaId: m.id });
  return m;
}

/** SPEC 6 rule 1 plus blocked clients (SPEC 14). */
export async function checkClientPhone(ctx: ServiceContext, input: { artisanId: string; phone: string }): Promise<ClientPhoneCheckResult> {
  const { crypto } = ctx.adapters;
  const hash = crypto.phoneHash(input.phone);
  const artisanPii = await ctx.prisma.artisanPii.findUnique({ where: { artisanId: input.artisanId } });
  const otherArtisan = await ctx.prisma.artisanPii.findUnique({ where: { phoneHash: hash }, include: { artisan: { select: { status: true } } } });
  const staff = await ctx.prisma.user.findUnique({ where: { phoneHash: hash }, select: { role: true } });
  const flag = checkClientIsRegisteredPhone({
    clientPhoneHash: hash,
    artisanPhoneHash: artisanPii?.phoneHash ?? '',
    belongsToRegisteredArtisanOrVerifier: Boolean((otherArtisan && otherArtisan.artisan.status !== 'deleted') || (staff && staff.role !== 'buyer')),
  });
  if (flag) return hash === artisanPii?.phoneHash ? 'own' : 'registered';
  const client = await ctx.prisma.client.findUnique({ where: { phoneHash: hash }, select: { blocked: true } });
  if (client?.blocked) return 'blocked';
  return 'ok';
}

export async function upsertClient(ctx: ServiceContext, phone: string, name: string, artisanId: string, lang: 'en' | 'sn' | 'nd') {
  const { crypto } = ctx.adapters;
  const phoneHash = crypto.phoneHash(phone);
  const existing = await ctx.prisma.client.findUnique({ where: { phoneHash } });
  if (existing) return existing;
  return ctx.prisma.client.create({
    data: { phoneHash, phoneEnc: crypto.encrypt(phone), nameEnc: crypto.encrypt(name), firstSeenAt: ctx.now(), firstArtisanId: artisanId, language: lang },
  });
}

/** SPEC 4.2 step 8: submit → fraud checks → client confirmation within a minute; AI runs in parallel (PLAN Q1). */
export async function submitJob(ctx: ServiceContext, jobId: string, input: SubmitJobInput, opts: { waitForOwnership?: boolean } = {}) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { artisan: { include: { pii: true } } } });
  const check = await checkClientPhone(ctx, { artisanId: job.artisanId, phone: input.clientPhone });
  if (check !== 'ok') throw new Error(`Client phone rejected: ${check}`);
  const client = await upsertClient(ctx, input.clientPhone, input.clientName, job.artisanId, job.artisan.language);
  await setJobStatus(ctx, jobId, 'submitted', 'artisan_submitted', {
    clientId: client.id,
    clientNameEnc: ctx.adapters.crypto.encrypt(input.clientName),
    jobDate: new Date(`${input.jobDate}T00:00:00Z`),
    areaId: input.areaId,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    amountChargedCents: input.amountCents,
    notes: input.notes,
    submittedAt: ctx.now(),
  });

  const { params: config } = await ctx.config();
  const area = await ctx.prisma.area.findUnique({ where: { id: input.areaId } });
  const loc = checkLocation({ shared: input.location, area: area?.lat != null && area.lng != null ? { lat: area.lat, lng: area.lng } : null }, config);
  if (loc) await raiseFlag(ctx, loc, jobId);
  const staff = await ctx.prisma.user.findUnique({ where: { phoneHash: client.phoneHash }, select: { createdAt: true } });
  const recent = checkRecentlyRegisteredClient(
    { clientFirstSeenAt: client.firstSeenAt, firstSeenForOtherArtisan: client.firstArtisanId !== job.artisanId, registeredAsUserAt: staff?.createdAt ?? null, jobSubmittedAt: ctx.now() },
    config,
  );
  if (recent) await raiseFlag(ctx, recent, jobId);

  await ctx.queue.enqueue('ai.process', { jobId });
  if (!opts.waitForOwnership) await ctx.queue.enqueue('confirmation.send', { jobId }, { jobId: `confirm:${jobId}` });
  await event(ctx, 'job_submitted', job.artisanId, { agentAssisted: job.agentAssisted });
  return { ref: job.ref };
}

export async function discardDraftJob(ctx: ServiceContext, jobId: string) {
  const job = await ctx.prisma.job.findUnique({ where: { id: jobId }, include: { media: true } });
  if (!job || job.status !== 'draft') return;
  for (const m of job.media) {
    if (m.originalKey) await ctx.adapters.storage.delete('private', m.originalKey).catch(() => undefined);
    if (m.publicKey) await ctx.adapters.storage.delete('public', m.publicKey).catch(() => undefined);
    if (m.thumbKey) await ctx.adapters.storage.delete('public', m.thumbKey).catch(() => undefined);
  }
  await ctx.prisma.job.delete({ where: { id: jobId } });
}

export function clientDisplayName(ctx: ServiceContext, enc: Uint8Array | null): string {
  return enc ? ctx.adapters.crypto.decrypt(enc) : '—';
}
