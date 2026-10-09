import {
  calculateLevel,
  competencyStatuses,
  levelRank,
  nudgeText,
  selectCountedJobs,
  t,
  levelName,
  trustScore,
  type CompetencyStatus,
  type LevelJob,
  type LevelResult,
  type MessageKey,
} from '@sp/core';
import type { Level, Prisma } from '@prisma/client';
import type { ServiceContext } from './context';
import { event } from './artisans';
import { notify } from './outbound';

export interface ArtisanStanding {
  result: LevelResult;
  configVersion: number;
  countedIds: Set<string>;
  unitStatus: Map<string, CompetencyStatus>;
  unitsByTrade: Record<string, string[]>;
}

/** Loads everything the rules engine needs for one artisan and evaluates it. Pure computation, no writes. */
export async function evaluateArtisan(ctx: ServiceContext, artisanId: string): Promise<ArtisanStanding> {
  const { params: config, version } = await ctx.config();
  const artisan = await ctx.prisma.artisan.findUniqueOrThrow({
    where: { id: artisanId },
    include: { trades: true, endorsements: true },
  });
  const jobs = await ctx.prisma.job.findMany({
    where: { artisanId, status: { notIn: ['draft', 'submitted'] } },
    include: { confirmation: true, review: true, competencies: true },
  });
  const levelJobs: LevelJob[] = jobs.map((j) => ({
    id: j.id,
    status: j.status,
    clientId: j.clientId,
    confirmedAt: j.confirmation?.response === 'confirmed' ? (j.confirmation.respondedAt ?? j.statusChangedAt) : j.status === 'client_confirmed' ? j.statusChangedAt : null,
    disputed: j.disputed,
    disputeResolvedForArtisan: j.disputeResolvedForArtisan,
    clientConfirmed: j.confirmation?.response === 'confirmed',
    flagged: j.flagRules.length > 0,
    jobDate: j.jobDate ?? j.createdAt,
    rating: j.confirmation?.rating ?? null,
    reviewQuality: j.review?.quality ?? null,
  }));
  const countedIds = selectCountedJobs(levelJobs, { maxPerClient: config.fraud.sameClientMaxPerArtisan, windowDays: config.fraud.sameClientWindowDays });

  const units = await ctx.prisma.competencyUnit.findMany({ where: { tradeId: { in: artisan.trades.map((t) => t.tradeId) }, active: true } });
  const unitsByTrade: Record<string, string[]> = {};
  for (const u of units) (unitsByTrade[u.tradeId] ??= []).push(u.id);
  const evidence = jobs.flatMap((j) => j.competencies.map((c) => ({ jobId: c.jobId, unitId: c.unitId, source: c.source, confidence: c.confidence, status: c.status })));
  const unitStatus = competencyStatuses(
    units.map((u) => u.id),
    evidence,
    jobs.map((j) => ({ id: j.id, status: j.status, counted: countedIds.has(j.id) })),
    config,
  );
  const verifiedUnitIds = [...unitStatus.entries()].filter(([, s]) => s === 'verified').map(([id]) => id);

  const result = calculateLevel(
    {
      jobs: levelJobs,
      endorsements: artisan.endorsements.map((e) => ({ verifierId: e.verifierId, tradeId: e.tradeId, withdrawn: e.withdrawnAt !== null })),
      tradeUnits: unitsByTrade,
      verifiedUnitIds,
      currentLevel: artisan.level,
      levelFrozen: artisan.levelFrozen,
    },
    config,
  );
  return { result, configVersion: version, countedIds, unitStatus, unitsByTrade };
}

/** SPEC 5: recalculated after every job status change. Writes counted flags, level, trust score and history. */
export async function recalculateLevel(ctx: ServiceContext, artisanId: string, reason: string, opts: { notify: boolean } = { notify: true }) {
  const artisan = await ctx.prisma.artisan.findUnique({ where: { id: artisanId } });
  if (!artisan || artisan.status === 'deleted') return null;
  const standing = await evaluateArtisan(ctx, artisanId);
  const { result } = standing;
  const { params: config } = await ctx.config();

  const jobs = await ctx.prisma.job.findMany({ where: { artisanId }, select: { id: true, counted: true, status: true, disputed: true, flagRules: true, confirmation: { select: { sentAt: true } } } });
  const changes = jobs.filter((j) => j.counted !== standing.countedIds.has(j.id));
  const reviews = await ctx.prisma.review.groupBy({ by: ['quality'], where: { job: { artisanId } }, _count: true });
  const rc = (q: string) => reviews.find((r) => r.quality === q)?._count ?? 0;
  const upheldFlags = await ctx.prisma.fraudFlag.findMany({ where: { entity: 'job', status: 'upheld', entityId: { in: jobs.map((j) => j.id) } }, select: { entityId: true } });
  const trust = trustScore(
    {
      jobsSent: jobs.filter((j) => j.confirmation?.sentAt).length,
      disputedOrRejected: jobs.filter((j) => j.disputed || j.status === 'rejected').length,
      flaggedJobs: new Set(upheldFlags.map((f) => f.entityId)).size,
      reviews: { meets: rc('meets'), needsImprovement: rc('needs_improvement'), reject: rc('reject') },
    },
    config,
  );

  const levelChanged = result.level !== artisan.level;
  await ctx.prisma.$transaction([
    ...changes.map((j) => ctx.prisma.job.update({ where: { id: j.id }, data: { counted: standing.countedIds.has(j.id) } })),
    ctx.prisma.artisan.update({ where: { id: artisanId }, data: { level: result.level as Level, trustScore: trust } }),
    ...(levelChanged
      ? [
          ctx.prisma.levelHistory.create({
            data: {
              artisanId,
              fromLevel: artisan.level,
              toLevel: result.level as Level,
              reason: { trigger: reason, stats: { ...result.stats, countedJobIds: undefined } } as unknown as Prisma.InputJsonValue,
              configVersion: standing.configVersion,
              at: ctx.now(),
            },
          }),
        ]
      : []),
  ]);

  if (levelChanged) {
    await event(ctx, 'level_changed', artisanId, { from: artisan.level, to: result.level });
    if (opts.notify) {
      const up = levelRank(result.level) > levelRank(artisan.level);
      await notify(
        ctx,
        { kind: 'artisan', id: artisanId },
        (lang) => {
          const name = levelName(lang, result.level);
          const nudge = nudgeText(lang, result.next);
          const head = up ? t(lang, 'notify.level_up', { level: name }) : t(lang, 'notify.level_down', { level: name, reason: t(lang, 'notify.level_down_reason') });
          return [{ kind: 'text', text: nudge ? `${head}\n\n${nudge}` : head }];
        },
        { purpose: 'level_changed', relatedEntity: 'artisan', relatedId: artisanId, ref: artisan.passportCode },
      );
    }
  }
  return { ...standing, previousLevel: artisan.level, levelChanged };
}

/** Short status sentence for job notifications: "Good news… 2 more jobs from new clients to reach Bronze." */
export function withNudge(lang: 'en' | 'sn' | 'nd', key: MessageKey, params: Record<string, string | number>, next: LevelResult['next']): string {
  const nudge = nudgeText(lang, next);
  return nudge ? `${t(lang, key, params)}\n\n${nudge}` : t(lang, key, params);
}
