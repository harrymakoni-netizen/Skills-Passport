import { canTransition, type FraudFlag } from '@sp/core';
import type { Prisma } from '@prisma/client';
import type { ServiceContext } from './context';

/** Stores a fraud flag (SPEC 6). Job flags are also denormalised onto jobs.flag_rules for queue ordering. */
export async function raiseFlag(ctx: ServiceContext, flag: FraudFlag, entityId: string): Promise<void> {
  if (flag.action === 'block') return;
  const existing = await ctx.prisma.fraudFlag.findFirst({ where: { entity: flag.entity, entityId, rule: flag.rule, status: 'open' } });
  if (existing) return;
  await ctx.prisma.fraudFlag.create({
    data: {
      entity: flag.entity,
      entityId,
      rule: flag.rule,
      severity: flag.severity,
      reason: flag.reason,
      evidence: (flag.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
      createdAt: ctx.now(),
    },
  });
  if (flag.entity === 'job') {
    const job = await ctx.prisma.job.findUnique({ where: { id: entityId }, select: { flagRules: true } });
    if (job && !job.flagRules.includes(flag.rule)) {
      await ctx.prisma.job.update({ where: { id: entityId }, data: { flagRules: { push: flag.rule } } });
    }
    // SPEC 5: flagged jobs are always reviewed.
    const j = await ctx.prisma.job.findUnique({ where: { id: entityId }, select: { status: true, reviewRequired: true } });
    if (j && j.status === 'client_confirmed' && canTransition('client_confirmed', 'under_review', 'selected_for_review')) {
      await ctx.prisma.job.update({
        where: { id: entityId },
        data: { status: 'under_review', statusChangedAt: ctx.now(), reviewRequired: true, reviewReason: 'flagged', queuedForReviewAt: ctx.now() },
      });
    } else if (j && !j.reviewRequired && ['awaiting_client', 'submitted'].includes(j.status)) {
      await ctx.prisma.job.update({ where: { id: entityId }, data: { reviewRequired: true, reviewReason: 'flagged' } });
    }
  }
  ctx.log.info({ rule: flag.rule, entity: flag.entity, entityId }, 'fraud flag raised');
}
