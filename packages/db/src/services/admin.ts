import { parseConfig, rulesConfigSchema, transition, type RulesConfig } from '@sp/core';
import { hashPassword } from '@sp/adapters';
import type { Prisma, UserRole } from '@prisma/client';
import type { ServiceContext } from './context';
import { recalculateLevel } from './levels';
import { notify } from './outbound';
import { t } from '@sp/core';

export async function audit(ctx: ServiceContext, actorId: string | null, action: string, entity: string, entityId: string | null, details?: Record<string, unknown>) {
  await ctx.prisma.auditLog.create({ data: { actorId, action, entity, entityId, details: (details ?? undefined) as Prisma.InputJsonValue | undefined, at: ctx.now() } });
}

// ------------------------------------------------------------------ fraud review (PROMPTS M7)

export async function listFlags(ctx: ServiceContext, status: 'open' | 'upheld' | 'cleared' = 'open') {
  const flags = await ctx.prisma.fraudFlag.findMany({ where: { status }, orderBy: [{ createdAt: 'desc' }], take: 200 });
  const order = { high: 0, standard: 1, soft: 2 } as const;
  flags.sort((a, b) => order[a.severity] - order[b.severity] || b.createdAt.getTime() - a.createdAt.getTime());
  const jobIds = flags.filter((f) => f.entity === 'job').map((f) => f.entityId);
  const jobs = await ctx.prisma.job.findMany({
    where: { id: { in: jobIds } },
    include: { artisan: { select: { id: true, displayName: true, passportCode: true, levelFrozen: true } }, jobType: true, media: { where: { thumbKey: { not: null } }, take: 3, orderBy: { sortOrder: 'asc' } } },
  });
  const artisanIds = flags.filter((f) => f.entity === 'artisan').map((f) => f.entityId);
  const artisans = await ctx.prisma.artisan.findMany({ where: { id: { in: artisanIds } }, select: { id: true, displayName: true, passportCode: true, levelFrozen: true } });
  const verifiers = await ctx.prisma.verifier.findMany({ where: { id: { in: flags.filter((f) => f.entity === 'verifier').map((f) => f.entityId) } }, select: { id: true, name: true } });
  return flags.map((f) => {
    const job = jobs.find((j) => j.id === f.entityId);
    return {
      id: f.id,
      entity: f.entity,
      entityId: f.entityId,
      rule: f.rule,
      severity: f.severity,
      reason: f.reason,
      evidence: f.evidence,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      resolutionNote: f.resolutionNote,
      job: job ? { id: job.id, ref: job.ref, status: job.status, jobType: (job.jobType.name as { en: string }).en, thumbs: job.media.map((m) => ctx.adapters.storage.publicUrl(m.thumbKey!)) } : null,
      artisan: job?.artisan ?? artisans.find((a) => a.id === f.entityId) ?? null,
      verifier: verifiers.find((v) => v.id === f.entityId) ?? null,
    };
  });
}

/** Uphold or clear a flag. Upheld flags can reject the job and/or freeze the artisan. Everything is audited. */
export async function resolveFlag(ctx: ServiceContext, adminUserId: string, flagId: string, input: { decision: 'uphold' | 'clear'; note: string; rejectJob?: boolean; freezeArtisan?: boolean }) {
  const flag = await ctx.prisma.fraudFlag.findUniqueOrThrow({ where: { id: flagId } });
  await ctx.prisma.fraudFlag.update({ where: { id: flagId }, data: { status: input.decision === 'uphold' ? 'upheld' : 'cleared', resolvedById: adminUserId, resolvedAt: ctx.now(), resolutionNote: input.note } });
  let artisanId: string | null = flag.entity === 'artisan' ? flag.entityId : null;
  if (flag.entity === 'job') {
    const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: flag.entityId } });
    artisanId = job.artisanId;
    if (input.decision === 'clear') {
      const remaining = await ctx.prisma.fraudFlag.findMany({ where: { entity: 'job', entityId: job.id, status: 'open' }, select: { rule: true } });
      await ctx.prisma.job.update({ where: { id: job.id }, data: { flagRules: remaining.map((r) => r.rule) } });
    }
    if (input.decision === 'uphold' && input.rejectJob && job.status !== 'rejected') {
      transition(job.status, 'rejected', job.status === 'under_review' ? 'admin_fraud_decision' : 'admin_fraud_decision');
      await ctx.prisma.job.update({ where: { id: job.id }, data: { status: 'rejected', statusChangedAt: ctx.now() } });
      await notify(ctx, { kind: 'artisan', id: job.artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.review.reject', { ref: job.ref }) }], { purpose: 'fraud_rejected', relatedEntity: 'job', relatedId: job.id, ref: job.ref });
    }
  }
  if (artisanId && input.decision === 'uphold' && input.freezeArtisan) await setFrozen(ctx, adminUserId, artisanId, true);
  if (artisanId && flag.rule === 'FR09_repeated_incidents' && input.decision === 'clear') await setFrozen(ctx, adminUserId, artisanId, false);
  if (artisanId) await recalculateLevel(ctx, artisanId, `flag_${input.decision}`);
  await audit(ctx, adminUserId, `flag.${input.decision}`, 'fraud_flag', flagId, { rule: flag.rule, note: input.note, rejectJob: input.rejectJob, freezeArtisan: input.freezeArtisan });
}

export async function setFrozen(ctx: ServiceContext, adminUserId: string, artisanId: string, frozen: boolean) {
  await ctx.prisma.artisan.update({ where: { id: artisanId }, data: { levelFrozen: frozen, status: frozen ? 'frozen' : 'active' } });
  await audit(ctx, adminUserId, frozen ? 'artisan.freeze' : 'artisan.unfreeze', 'artisan', artisanId);
  if (frozen) await notify(ctx, { kind: 'artisan', id: artisanId }, (l) => [{ kind: 'text', text: t(l, 'notify.frozen') }], { purpose: 'frozen' });
  await recalculateLevel(ctx, artisanId, frozen ? 'frozen' : 'unfrozen', { notify: false });
}

/** Admin resolves a client dispute in the artisan's favour (PLAN Q3), e.g. after a field-agent call. */
export async function resolveDispute(ctx: ServiceContext, adminUserId: string, jobId: string, forArtisan: boolean, note: string) {
  const job = await ctx.prisma.job.update({ where: { id: jobId }, data: { disputeResolvedForArtisan: forArtisan } });
  await audit(ctx, adminUserId, 'dispute.resolve', 'job', jobId, { forArtisan, note });
  await recalculateLevel(ctx, job.artisanId, 'dispute_resolved');
}

// ------------------------------------------------------------------ versioned configuration

export async function listConfigs(ctx: ServiceContext) {
  return ctx.prisma.config.findMany({ orderBy: { version: 'desc' } });
}

/** Never edits in place: every change creates a new version (PROMPTS M7). */
export async function createConfigVersion(ctx: ServiceContext, adminUserId: string, params: unknown, note: string): Promise<{ version: number; params: RulesConfig }> {
  const parsed = rulesConfigSchema.safeParse(params);
  if (!parsed.success) throw Object.assign(new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')), { status: 400 });
  const latest = await ctx.prisma.config.findFirst({ orderBy: { version: 'desc' } });
  const version = (latest?.version ?? 0) + 1;
  await ctx.prisma.config.create({ data: { version, params: parsed.data as unknown as Prisma.InputJsonValue, activeFrom: ctx.now(), createdById: adminUserId, note } });
  (ctx.config as unknown as { invalidate?: () => void }).invalidate?.();
  await audit(ctx, adminUserId, 'config.create_version', 'config', String(version), { note });
  return { version, params: parseConfig(parsed.data) };
}

// ------------------------------------------------------------------ people

export async function createStaffUser(
  ctx: ServiceContext,
  adminUserId: string,
  input: { role: UserRole; name: string; email: string; phone: string; password: string; tradeIds?: string[]; areaId?: string; yearsExperience?: number },
) {
  const { crypto } = ctx.adapters;
  const user = await ctx.prisma.user.create({
    data: {
      role: input.role,
      name: input.name,
      emailHash: crypto.lookupHash(input.email),
      emailEnc: crypto.encrypt(input.email.trim().toLowerCase()),
      phoneHash: crypto.phoneHash(input.phone),
      phoneEnc: crypto.encrypt(input.phone),
      passwordHash: await hashPassword(input.password),
      createdAt: ctx.now(),
    },
  });
  if (input.role === 'verifier') {
    await ctx.prisma.verifier.create({
      data: { userId: user.id, name: input.name, areaId: input.areaId ?? null, yearsExperience: input.yearsExperience ?? 0, status: 'active', approvedById: adminUserId, trades: { create: (input.tradeIds ?? []).map((tradeId) => ({ tradeId })) } },
    });
  }
  if (input.role === 'agent') await ctx.prisma.fieldAgent.create({ data: { userId: user.id, name: input.name, areaId: input.areaId ?? null } });
  await audit(ctx, adminUserId, 'user.create', 'user', user.id, { role: input.role });
  return user;
}

// ------------------------------------------------------------------ pilot report (SPEC 16)

const MIN_CELL = 5;
const cell = (n: number) => (n > 0 && n < MIN_CELL ? null : n);

/** Aggregate metrics only. Counts below 5 are suppressed (null) to protect individuals. */
export async function pilotReport(ctx: ServiceContext, from: Date, to: Date) {
  const p = ctx.prisma;
  const range = { gte: from, lte: to };
  const artisans = await p.artisan.findMany({ where: { joinedAt: range }, select: { id: true, gender: true, disability: true, area: { select: { city: true } }, trades: { select: { trade: { select: { code: true } } } } } });
  const groupCount = <T extends string>(items: T[]) => Object.fromEntries([...items.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].map(([k, v]) => [k, cell(v)]));
  const jobsLogged = await p.job.count({ where: { submittedAt: range } });
  const sent = await p.confirmation.count({ where: { sentAt: range } });
  const confirmed = await p.confirmation.count({ where: { sentAt: range, response: 'confirmed' } });
  const disputed = await p.job.count({ where: { submittedAt: range, disputed: true } });
  const rejected = await p.job.count({ where: { submittedAt: range, status: 'rejected' } });
  const flagged = await p.job.count({ where: { submittedAt: range, NOT: { flagRules: { isEmpty: true } } } });
  const upheld = await p.fraudFlag.count({ where: { createdAt: range, status: 'upheld' } });
  const resolved = await p.fraudFlag.count({ where: { createdAt: range, status: { in: ['upheld', 'cleared'] } } });
  const turnaround = await p.$queryRaw<{ median_hours: number | null }[]>`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM r.created_at - j.queued_for_review_at) / 3600) AS median_hours
    FROM reviews r JOIN jobs j ON j.id = r.job_id WHERE r.created_at BETWEEN ${from} AND ${to} AND j.queued_for_review_at IS NOT NULL`;
  const timeToLevel = await p.$queryRaw<{ to_level: string; median_days: number | null; n: bigint }[]>`
    SELECT h.to_level, percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM h.at - a.joined_at) / 86400) AS median_days, count(*) AS n
    FROM level_history h JOIN artisans a ON a.id = h.artisan_id
    WHERE h.at BETWEEN ${from} AND ${to} AND h.to_level <> 'starter'
      AND h.at = (SELECT min(h2.at) FROM level_history h2 WHERE h2.artisan_id = h.artisan_id AND h2.to_level = h.to_level)
    GROUP BY h.to_level`;
  const wr = await p.workRequest.groupBy({ by: ['status'], where: { createdAt: range }, _count: true });
  const hired = await p.workRequest.count({ where: { createdAt: range, outcome: 'hired' } });
  const activeArtisans = await p.job.findMany({ where: { submittedAt: range }, distinct: ['artisanId'], select: { artisanId: true } });
  const months = Math.max(1, (to.getTime() - from.getTime()) / (30 * 86400000));
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    minimumCellSize: MIN_CELL,
    artisansEnrolled: {
      total: cell(artisans.length),
      byTrade: groupCount(artisans.flatMap((a) => a.trades.map((t) => t.trade.code))),
      byCity: groupCount(artisans.map((a) => a.area.city)),
      byGender: groupCount(artisans.filter((a) => a.gender).map((a) => a.gender!)),
      byDisability: groupCount(artisans.filter((a) => a.disability).map((a) => a.disability!)),
    },
    jobsLogged: { total: cell(jobsLogged), perActiveArtisanPerMonth: activeArtisans.length >= MIN_CELL ? Math.round((jobsLogged / activeArtisans.length / months) * 10) / 10 : null },
    confirmationRate: sent >= MIN_CELL ? Math.round((confirmed / sent) * 1000) / 10 : null,
    disputeAndRejectionRate: jobsLogged >= MIN_CELL ? Math.round(((disputed + rejected) / jobsLogged) * 1000) / 10 : null,
    timeToLevel: Object.fromEntries(timeToLevel.map((r) => [r.to_level, Number(r.n) >= MIN_CELL ? Math.round(Number(r.median_days) * 10) / 10 : null])),
    verifierTurnaroundHours: turnaround[0]?.median_hours != null ? Math.round(Number(turnaround[0].median_hours) * 10) / 10 : null,
    flagRate: jobsLogged >= MIN_CELL ? Math.round((flagged / jobsLogged) * 1000) / 10 : null,
    flagsUpheldShare: resolved >= MIN_CELL ? Math.round((upheld / resolved) * 1000) / 10 : null,
    workRequests: { sent: cell(wr.reduce((n, r) => n + r._count, 0)), accepted: cell(wr.find((r) => r.status === 'accepted')?._count ?? 0), hired: cell(hired) },
  };
}

/** Admin dashboard overview counts (operational, not published). */
export async function overview(ctx: ServiceContext) {
  const p = ctx.prisma;
  const [artisans, levels, awaiting, underReview, openFlags, agentTasks, jobs30] = await Promise.all([
    p.artisan.count({ where: { status: { not: 'deleted' } } }),
    p.artisan.groupBy({ by: ['level'], where: { status: { not: 'deleted' } }, _count: true }),
    p.job.count({ where: { status: 'awaiting_client' } }),
    p.job.count({ where: { status: 'under_review' } }),
    p.fraudFlag.count({ where: { status: 'open' } }),
    p.agentTask.count({ where: { status: 'open' } }),
    p.job.count({ where: { submittedAt: { gte: new Date(ctx.now().getTime() - 30 * 86400000) } } }),
  ]);
  return { artisans, levels: Object.fromEntries(levels.map((l) => [l.level, l._count])), awaiting, underReview, openFlags, agentTasks, jobs30 };
}
