import { buildTemplate, canEndorse, checkVerifierApprovalRate, checkVerifierConflict, t, type MessageKey } from '@sp/core';
import type { ReviewQuality } from '@prisma/client';
import type { ServiceContext } from './context';
import { event } from './artisans';
import { raiseFlag } from './fraud';
import { setJobStatus } from './jobs';
import { recalculateLevel, withNudge } from './levels';
import { notify } from './outbound';
import { localized, tradeName } from './reference';

export class ForbiddenError extends Error {
  readonly status = 403;
}

async function verifierOrThrow(ctx: ServiceContext, verifierId: string) {
  const v = await ctx.prisma.verifier.findUnique({ where: { id: verifierId }, include: { trades: true, conflicts: true } });
  if (!v || v.status !== 'active') throw new ForbiddenError('Verifier is not active');
  return v;
}

/** SPEC 4.4 queue: jobs in the verifier's trades, flagged first, then oldest; conflicted artisans excluded. */
export async function reviewQueue(ctx: ServiceContext, verifierId: string, filter: { tradeId?: string; flaggedOnly?: boolean } = {}) {
  const v = await verifierOrThrow(ctx, verifierId);
  const tradeIds = v.trades.map((t) => t.tradeId).filter((id) => !filter.tradeId || id === filter.tradeId);
  const jobs = await ctx.prisma.job.findMany({
    where: {
      status: 'under_review',
      tradeId: { in: tradeIds },
      artisanId: { notIn: v.conflicts.map((c) => c.artisanId) },
      ...(filter.flaggedOnly ? { NOT: { flagRules: { isEmpty: true } } } : {}),
    },
    include: {
      artisan: { select: { displayName: true, passportCode: true, level: true } },
      jobType: true,
      trade: true,
      area: true,
      media: { where: { kind: { in: ['photo_after', 'photo_before'] }, thumbKey: { not: null } }, orderBy: [{ kind: 'desc' }, { sortOrder: 'asc' }], take: 1 },
    },
    orderBy: { queuedForReviewAt: 'asc' },
    take: 200,
  });
  const items = jobs.map((j) => ({
    id: j.id,
    ref: j.ref,
    artisan: j.artisan,
    trade: tradeName(j.trade),
    jobType: localized(j.jobType.name),
    area: j.area?.name ?? null,
    jobDate: j.jobDate?.toISOString() ?? null,
    queuedAt: (j.queuedForReviewAt ?? j.statusChangedAt).toISOString(),
    reason: j.reviewReason,
    flags: j.flagRules,
    disputed: j.disputed,
    thumb: j.media[0]?.thumbKey ? ctx.adapters.storage.publicUrl(j.media[0].thumbKey) : null,
  }));
  return items.sort((a, b) => Number(b.flags.length > 0 || b.disputed) - Number(a.flags.length > 0 || a.disputed) || a.queuedAt.localeCompare(b.queuedAt));
}

/** Everything a verifier sees for one job: photos (signed private originals), video, transcript, AI summary, units. */
export async function reviewDetail(ctx: ServiceContext, verifierId: string, jobId: string) {
  const v = await verifierOrThrow(ctx, verifierId);
  const job = await ctx.prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      artisan: { include: { endorsements: { where: { withdrawnAt: null } } } },
      jobType: true,
      trade: { include: { units: { where: { active: true }, orderBy: { code: 'asc' } } } },
      area: true,
      media: { orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }], include: { transcript: true } },
      competencies: true,
      review: true,
      confirmation: { select: { response: true, rating: true, comment: true, respondedAt: true, channel: true } },
    },
  });
  if (!v.trades.some((t) => t.tradeId === job.tradeId)) throw new ForbiddenError('This job is outside your trades');
  if (checkVerifierConflict({ conflictedArtisanIds: v.conflicts.map((c) => c.artisanId), artisanId: job.artisanId })) throw new ForbiddenError('You declared a conflict of interest with this artisan');
  const { storage } = ctx.adapters;
  const flags = await ctx.prisma.fraudFlag.findMany({ where: { entity: 'job', entityId: jobId }, orderBy: { createdAt: 'asc' } });
  const meetsByMe = await ctx.prisma.review.count({ where: { verifierId, quality: 'meets', job: { artisanId: job.artisanId } } });
  const { params: config } = await ctx.config();
  const endorse = canEndorse(
    { meetsReviewsByThisVerifier: meetsByMe, conflicted: false, alreadyEndorsedTrade: job.artisan.endorsements.some((e) => e.verifierId === verifierId && e.tradeId === job.tradeId), verifierCoversTrade: true },
    config,
  );
  const media = await Promise.all(
    job.media.map(async (m) => ({
      id: m.id,
      kind: m.kind,
      url: m.originalKey && m.kind !== 'video' && m.kind !== 'voice' ? (m.publicKey ? storage.publicUrl(m.publicKey) : await storage.signedGetUrl('private', m.originalKey, 900)) : m.originalKey ? await storage.signedGetUrl('private', m.originalKey, 900) : null,
      thumb: m.thumbKey ? storage.publicUrl(m.thumbKey) : null,
      width: m.width,
      height: m.height,
      durationSec: m.durationSec,
      capturedAt: m.capturedAt?.toISOString() ?? null,
      quality: m.qualityScore,
      duplicate: Boolean(m.duplicateOfId),
      transcript: m.transcript ? { text: m.transcript.text, confidence: m.transcript.confidence, language: m.transcript.language } : null,
    })),
  );
  const unitById = new Map(job.trade.units.map((u) => [u.id, u]));
  return {
    id: job.id,
    ref: job.ref,
    status: job.status,
    artisan: { id: job.artisanId, displayName: job.artisan.displayName, passportCode: job.artisan.passportCode, level: job.artisan.level },
    trade: tradeName(job.trade),
    jobType: localized(job.jobType.name),
    jobDate: job.jobDate?.toISOString() ?? null,
    area: job.area?.name ?? null,
    agentAssisted: job.agentAssisted,
    reviewReason: job.reviewReason,
    disputed: job.disputed,
    notes: job.notes,
    aiSummary: job.aiSummary,
    artisanSummary: job.artisanSummary,
    confirmation: job.confirmation,
    media,
    flags: flags.map((f) => ({ rule: f.rule, severity: f.severity, reason: f.reason, status: f.status })),
    units: job.trade.units.map((u) => {
      const ai = job.competencies.find((c) => c.unitId === u.id && c.source === 'ai');
      const ver = job.competencies.find((c) => c.unitId === u.id && c.source === 'verifier');
      return { id: u.id, code: u.code, title: localized(u.title), evidenceGuidance: u.evidenceGuidance, aiConfidence: ai?.confidence ?? null, aiEvidence: ai?.evidence ?? [], verifierStatus: ver?.status ?? null };
    }),
    suggestedUnitIds: job.competencies.filter((c) => c.source === 'ai' && (c.confidence ?? 0) >= 0.5).map((c) => c.unitId).filter((id) => unitById.has(id)),
    review: job.review,
    endorsement: endorse.ok ? { eligible: true as const } : { eligible: false as const, reason: endorse.reason, meetsByMe, needed: config.endorsement.minMeetsReviews },
  };
}

/** SPEC 4.4: rate quality, confirm/remove/add units, note to the artisan. */
export async function submitReview(
  ctx: ServiceContext,
  verifierId: string,
  jobId: string,
  input: { quality: ReviewQuality; confirmedUnitIds: string[]; removedUnitIds: string[]; note?: string | null },
) {
  const detail = await reviewDetail(ctx, verifierId, jobId);
  if (detail.status !== 'under_review') throw new ForbiddenError('This job is not waiting for review');
  const valid = new Set(detail.units.map((u) => u.id));
  const confirmed = input.confirmedUnitIds.filter((id) => valid.has(id));
  const removed = input.removedUnitIds.filter((id) => valid.has(id) && !confirmed.includes(id));
  const to = input.quality === 'meets' ? 'verified' : input.quality === 'needs_improvement' ? 'needs_improvement' : 'rejected';
  await ctx.prisma.$transaction([
    ctx.prisma.review.create({ data: { jobId, verifierId, quality: input.quality, noteToArtisan: input.note?.trim() || null, createdAt: ctx.now() } }),
    ...confirmed.map((unitId) =>
      ctx.prisma.jobCompetency.upsert({
        where: { jobId_unitId_source: { jobId, unitId, source: 'verifier' } },
        create: { jobId, unitId, source: 'verifier', status: input.quality === 'reject' ? 'removed' : 'confirmed', reviewerId: verifierId },
        update: { status: input.quality === 'reject' ? 'removed' : 'confirmed', reviewerId: verifierId },
      }),
    ),
    ...removed.map((unitId) =>
      ctx.prisma.jobCompetency.upsert({
        where: { jobId_unitId_source: { jobId, unitId, source: 'verifier' } },
        create: { jobId, unitId, source: 'verifier', status: 'removed', reviewerId: verifierId },
        update: { status: 'removed', reviewerId: verifierId },
      }),
    ),
  ]);
  await setJobStatus(ctx, jobId, to, 'review_decision');

  const { params: config } = await ctx.config();
  const totals = await ctx.prisma.review.groupBy({ by: ['quality'], where: { verifierId }, _count: true });
  const all = totals.reduce((n, r) => n + r._count, 0);
  const meets = totals.find((r) => r.quality === 'meets')?._count ?? 0;
  const rate = checkVerifierApprovalRate({ reviews: all, meets }, config);
  if (rate) await raiseFlag(ctx, rate, verifierId);

  const standing = await recalculateLevel(ctx, detail.artisan.id, 'review_completed');
  const key = `notify.review.${input.quality}` as MessageKey;
  const note = input.note?.trim();
  await notify(
    ctx,
    { kind: 'artisan', id: detail.artisan.id },
    (l) => [buildTemplate('artisan_review_result', l, [detail.ref, [withNudge(l, key, { ref: detail.ref }, input.quality === 'reject' ? null : standing?.result.next ?? null), note ? t(l, 'notify.review_note', { note }) : ''].filter(Boolean).join(' ')], detail.id)],
    { purpose: 'review_result', relatedEntity: 'job', relatedId: jobId },
  );
  await event(ctx, 'review_completed', detail.artisan.id, { quality: input.quality });
  return { status: to };
}

export async function endorseArtisan(ctx: ServiceContext, verifierId: string, artisanId: string, tradeId: string, statement: string) {
  const v = await verifierOrThrow(ctx, verifierId);
  const { params: config } = await ctx.config();
  const conflicted = checkVerifierConflict({ conflictedArtisanIds: v.conflicts.map((c) => c.artisanId), artisanId });
  if (conflicted) {
    await raiseFlag(ctx, { ...conflicted, action: 'flag' }, verifierId);
    throw new ForbiddenError('You declared a conflict of interest with this artisan');
  }
  const meets = await ctx.prisma.review.count({ where: { verifierId, quality: 'meets', job: { artisanId, tradeId } } });
  const existing = await ctx.prisma.endorsement.findFirst({ where: { verifierId, artisanId, tradeId, withdrawnAt: null } });
  const ok = canEndorse({ meetsReviewsByThisVerifier: meets, conflicted: false, alreadyEndorsedTrade: Boolean(existing), verifierCoversTrade: v.trades.some((t) => t.tradeId === tradeId) }, config);
  if (!ok.ok) throw new ForbiddenError(`Cannot endorse: ${ok.reason}`);
  const e = await ctx.prisma.endorsement.create({ data: { verifierId, artisanId, tradeId, statement: statement.trim().slice(0, 400), createdAt: ctx.now() }, include: { trade: true } });
  await recalculateLevel(ctx, artisanId, 'endorsed');
  await notify(ctx, { kind: 'artisan', id: artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.endorsed', { verifier: v.name, trade: tradeName(e.trade)[l] }) }], { purpose: 'endorsed', relatedEntity: 'endorsement', relatedId: e.id });
  await ctx.prisma.auditLog.create({ data: { actorId: v.userId, action: 'endorsement.create', entity: 'artisan', entityId: artisanId, at: ctx.now() } });
  return e;
}

export async function withdrawEndorsement(ctx: ServiceContext, actor: { verifierId?: string; adminUserId?: string }, endorsementId: string, reason: string) {
  const e = await ctx.prisma.endorsement.findUniqueOrThrow({ where: { id: endorsementId } });
  if (actor.verifierId && e.verifierId !== actor.verifierId) throw new ForbiddenError('Not your endorsement');
  await ctx.prisma.endorsement.update({ where: { id: e.id }, data: { withdrawnAt: ctx.now(), withdrawnReason: reason } });
  await recalculateLevel(ctx, e.artisanId, 'endorsement_withdrawn');
  await notify(ctx, { kind: 'artisan', id: e.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.endorsement_withdrawn') }], { purpose: 'endorsement_withdrawn' });
  await ctx.prisma.auditLog.create({ data: { actorId: actor.adminUserId ?? actor.verifierId ?? null, action: 'endorsement.withdraw', entity: 'endorsement', entityId: e.id, details: { reason }, at: ctx.now() } });
}

export async function requestDemonstration(ctx: ServiceContext, verifierId: string, jobId: string, note?: string) {
  const detail = await reviewDetail(ctx, verifierId, jobId);
  await ctx.prisma.demonstrationRequest.create({ data: { jobId, verifierId, note: note ?? null, createdAt: ctx.now() } });
  await ctx.prisma.agentTask.create({ data: { kind: 'demonstration', jobId, artisanId: detail.artisan.id, note: note ?? 'Arrange a practical demonstration.', createdAt: ctx.now() } });
  await notify(ctx, { kind: 'artisan', id: detail.artisan.id }, (l) => [{ kind: 'text', text: t(l, 'notify.demo_requested', { ref: detail.ref }) }], { purpose: 'demo_requested', relatedEntity: 'job', relatedId: jobId, ref: detail.ref });
}

/** Reviews completed per verifier per month, for paying verifiers per review (PROMPTS M6). */
export async function verifierMonthlyCounts(ctx: ServiceContext, months = 6) {
  const since = new Date(ctx.now().getTime() - months * 31 * 86400000);
  const rows = await ctx.prisma.$queryRaw<{ verifier_id: string; name: string; month: string; reviews: bigint }[]>`
    SELECT r.verifier_id, v.name, to_char(date_trunc('month', r.created_at AT TIME ZONE 'Africa/Harare'), 'YYYY-MM') AS month, count(*) AS reviews
    FROM reviews r JOIN verifiers v ON v.id = r.verifier_id
    WHERE r.created_at >= ${since}
    GROUP BY 1, 2, 3 ORDER BY 3 DESC, 2 ASC`;
  return rows.map((r) => ({ verifierId: r.verifier_id, name: r.name, month: r.month, reviews: Number(r.reviews) }));
}
