import { buildTemplate, t, type NewArtisanInput } from '@sp/core';
import type { ServiceContext } from './context';
import { createArtisan } from './artisans';
import { notify } from './outbound';
import { localized } from './reference';

/** SPEC 4.5: agent-assisted job — the artisan confirms on WhatsApp that it is theirs before the client is asked. */
export async function requestOwnership(ctx: ServiceContext, jobId: string) {
  const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { agent: true, jobType: true } });
  await notify(ctx, { kind: 'artisan', id: job.artisanId }, (l) => [buildTemplate('artisan_job_ownership', l, [job.agent?.name ?? 'Skills Passport', localized(job.jobType.name)[l], job.ref], job.id)], {
    purpose: 'job_ownership',
    relatedEntity: 'job',
    relatedId: jobId,
  });
}

export async function confirmOwnership(ctx: ServiceContext, input: { artisanId: string; jobId: string; mine: boolean }) {
  const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job || job.artisanId !== input.artisanId || !job.agentAssisted || job.artisanConfirmedAt || job.status !== 'submitted') return null;
  if (input.mine) {
    await ctx.prisma.job.update({ where: { id: job.id }, data: { artisanConfirmedAt: ctx.now() } });
    await ctx.queue.enqueue('confirmation.send', { jobId: job.id }, { jobId: `confirm:${job.id}` });
  } else {
    await ctx.prisma.fraudFlag.create({
      data: { entity: 'job', entityId: job.id, rule: 'AGENT_JOB_DENIED', severity: 'high', reason: 'Artisan said an agent-logged job is not theirs', createdAt: ctx.now() },
    });
    await ctx.prisma.job.update({ where: { id: job.id }, data: { flagRules: { push: 'AGENT_JOB_DENIED' } } });
    await ctx.prisma.auditLog.create({ data: { action: 'job.ownership_denied', entity: 'job', entityId: job.id, at: ctx.now(), details: { agentId: job.agentId } } });
  }
  return { ref: job.ref };
}

export async function enrolArtisan(ctx: ServiceContext, agentId: string, input: Omit<NewArtisanInput, 'consentTextVersion' | 'profilePhoto'>) {
  const a = await createArtisan(ctx, { ...input, profilePhoto: null, consentTextVersion: 'consent-v1', enrolledByAgentId: agentId, channel: 'agent' });
  await notify(ctx, { kind: 'artisan', id: a.id }, (l) => [{ kind: 'text', text: t(l, 'ob.done', { code: a.passportCode, link: `${ctx.publicBaseUrl}/p/${a.passportCode}` }) }], {
    purpose: 'agent_enrolment',
    relatedEntity: 'artisan',
    relatedId: a.id,
    ref: a.passportCode,
  });
  await ctx.prisma.auditLog.create({ data: { actorId: agentId, action: 'agent.enrol', entity: 'artisan', entityId: a.id, at: ctx.now() } });
  return a;
}

