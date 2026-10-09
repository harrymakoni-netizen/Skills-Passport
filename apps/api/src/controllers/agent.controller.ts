import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Post, Query } from '@nestjs/common';
import { MAX_AGE, MIN_AGE, normalisePhone } from '@sp/core';
import { attachMedia, checkClientPhone, createDraftJob, enrolArtisan, recordAgentFollowUp, requestOwnership, submitJob, type ServiceContext } from '@sp/db';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../infra/auth';
import { CurrentUser, parse, type SessionUser } from '../infra/http';
import { CTX } from '../infra/tokens';

const enrolBody = z.object({
  phone: z.string(),
  fullName: z.string().min(3).max(80),
  birthYear: z.number().int(),
  lang: z.enum(['en', 'sn', 'nd']),
  tradeIds: z.array(z.string()).min(1).max(2),
  areaId: z.string(),
  experienceYears: z.number().int().min(0).max(40),
  howLearned: z.enum(['apprenticeship', 'family', 'self_taught', 'college', 'other']),
  consentConfirmed: z.literal(true),
});

const jobBody = z.object({
  passportCode: z.string(),
  jobTypeId: z.string(),
  clientName: z.string().min(2).max(60),
  clientPhone: z.string(),
  jobDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  areaId: z.string(),
  amountCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(1000).optional(),
  uploads: z.array(z.object({ key: z.string(), kind: z.enum(['photo_before', 'photo_after', 'video', 'voice']) })).min(1).max(10),
  artisanPresent: z.literal(true),
});

/** SPEC 4.5 field agents: enrol, log jobs with the artisan present, phone follow-ups. Agents can't confirm or endorse. */
@Roles('agent')
@Controller()
export class AgentController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  @Post('agent/artisans')
  @HttpCode(200)
  async enrol(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(enrolBody, body);
    const phone = normalisePhone(b.phone);
    if (!phone) throw new ForbiddenException('Phone number is not valid');
    const age = this.ctx.now().getUTCFullYear() - b.birthYear;
    if (age < MIN_AGE || age - 1 > MAX_AGE) throw new ForbiddenException(`Skills Passport is for artisans aged ${MIN_AGE} to ${MAX_AGE}`);
    const a = await enrolArtisan(this.ctx, u.agentId!, {
      phone,
      lang: b.lang,
      fullName: b.fullName.trim(),
      birthYear: b.birthYear,
      tradeIds: b.tradeIds,
      areaId: b.areaId,
      areaPending: false,
      experienceYears: b.experienceYears,
      howLearned: b.howLearned,
      demographicsConsent: false,
      gender: null,
      disability: null,
      publicBadges: [],
    });
    return { id: a.id, passportCode: a.passportCode, displayName: a.displayName };
  }

  @Get('agent/artisans')
  async find(@Query('q') q: string) {
    const term = (q ?? '').trim();
    let artisanId: string | null = null;
    if (/^SP-[A-Z]{3}-\d{5}$/i.test(term)) artisanId = (await this.ctx.prisma.artisan.findUnique({ where: { passportCode: term.toUpperCase() } }))?.id ?? null;
    else {
      const phone = normalisePhone(term);
      if (phone) artisanId = (await this.ctx.prisma.artisanPii.findUnique({ where: { phoneHash: this.ctx.adapters.crypto.phoneHash(phone) } }))?.artisanId ?? null;
    }
    if (!artisanId) throw new NotFoundException('No artisan with that passport number or phone');
    const a = await this.ctx.prisma.artisan.findUniqueOrThrow({ where: { id: artisanId }, include: { area: true, trades: { include: { trade: { include: { jobTypes: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } } } } } });
    if (a.status === 'deleted') throw new NotFoundException();
    return {
      id: a.id,
      passportCode: a.passportCode,
      displayName: a.displayName,
      level: a.level,
      area: { id: a.areaId, name: a.area.name, cityCode: a.area.cityCode },
      trades: a.trades.map((t) => ({ id: t.tradeId, name: t.trade.nameEn, jobTypes: t.trade.jobTypes.map((j) => ({ id: j.id, name: (j.name as { en: string }).en, needsBeforePhoto: j.needsBeforePhoto })) })),
    };
  }

  /** Signed upload URL for the agent's phone browser (SPEC 12 POST /media/upload-url). */
  @Post('media/upload-url')
  @HttpCode(200)
  async uploadUrl(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const { kind, mimeType } = parse(z.object({ kind: z.enum(['photo_before', 'photo_after', 'video', 'voice']), mimeType: z.string().regex(/^(image|audio|video)\/[\w.+-]+$/) }), body);
    const ext = mimeType.split('/')[1]!.replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 4);
    const key = `originals/agent/${u.agentId}/${randomUUID()}.${ext}`;
    const url = await this.ctx.adapters.storage.signedPutUrl('private', key, { contentType: mimeType, ttlSec: 900 });
    await this.ctx.prisma.mediaUploadRequest.create({ data: { agentId: u.agentId!, key, kind, mimeType, expiresAt: new Date(this.ctx.now().getTime() + 900_000) } });
    return { key, url };
  }

  @Post('agent/jobs')
  @HttpCode(200)
  async logJob(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(jobBody, body);
    const artisan = await this.ctx.prisma.artisan.findUnique({ where: { passportCode: b.passportCode }, include: { trades: true } });
    if (!artisan || artisan.status !== 'active') throw new NotFoundException('Artisan not found');
    const jobType = await this.ctx.prisma.jobType.findUniqueOrThrow({ where: { id: b.jobTypeId } });
    if (!artisan.trades.some((t) => t.tradeId === jobType.tradeId)) throw new ForbiddenException('Job type is not in the artisan’s trades');
    const phone = normalisePhone(b.clientPhone);
    if (!phone) throw new ForbiddenException('Client phone number is not valid');
    const check = await checkClientPhone(this.ctx, { artisanId: artisan.id, phone });
    if (check !== 'ok') throw new ForbiddenException(check === 'blocked' ? 'This client cannot confirm jobs.' : 'The client must be someone other than the artisan, a verifier or another artisan.');
    const uploads = await this.ctx.prisma.mediaUploadRequest.findMany({ where: { key: { in: b.uploads.map((x) => x.key) }, agentId: u.agentId!, usedAt: null, expiresAt: { gte: this.ctx.now() } } });
    if (uploads.length !== b.uploads.length) throw new ForbiddenException('Some uploads are missing or expired');
    for (const up of uploads) if (!(await this.ctx.adapters.storage.exists('private', up.key))) throw new ForbiddenException('An upload did not finish');
    const { jobId, ref } = await createDraftJob(this.ctx, { artisanId: artisan.id, tradeId: jobType.tradeId, jobTypeId: jobType.id, agentId: u.agentId! });
    for (const up of uploads) {
      await attachMedia(this.ctx, { jobId, kind: up.kind, originalKey: up.key, mimeType: up.mimeType });
      await this.ctx.prisma.mediaUploadRequest.update({ where: { id: up.id }, data: { usedAt: this.ctx.now() } });
    }
    await submitJob(this.ctx, jobId, { clientName: b.clientName, clientPhone: phone, jobDate: b.jobDate, areaId: b.areaId, location: null, amountCents: b.amountCents ?? null, notes: b.notes ? [b.notes] : [] }, { waitForOwnership: true });
    await requestOwnership(this.ctx, jobId);
    await this.ctx.prisma.auditLog.create({ data: { actorId: u.id, action: 'agent.log_job', entity: 'job', entityId: jobId, at: this.ctx.now() } });
    return { jobId, ref };
  }

  @Get('agent/tasks')
  async tasks(@CurrentUser() u: SessionUser) {
    const tasks = await this.ctx.prisma.agentTask.findMany({ where: { status: 'open', OR: [{ assignedTo: null }, { assignedTo: u.agentId! }] }, orderBy: { createdAt: 'asc' }, take: 100 });
    const jobs = await this.ctx.prisma.job.findMany({ where: { id: { in: tasks.map((t) => t.jobId).filter((x): x is string => !!x) } }, include: { client: true, artisan: true, jobType: true } });
    const artisans = await this.ctx.prisma.artisan.findMany({ where: { id: { in: tasks.map((t) => t.artisanId).filter((x): x is string => !!x) } }, include: { pii: true } });
    const { crypto } = this.ctx.adapters;
    return tasks.map((t) => {
      const job = jobs.find((j) => j.id === t.jobId);
      const a = artisans.find((x) => x.id === t.artisanId);
      return {
        id: t.id,
        kind: t.kind,
        note: t.note,
        createdAt: t.createdAt,
        artisan: a ? { displayName: a.displayName, passportCode: a.passportCode, phone: a.pii ? crypto.decrypt(a.pii.phoneEnc) : null } : null,
        // Field agents need the client's number to call them; it is shown only to agents, never publicly.
        job: job ? { id: job.id, ref: job.ref, status: job.status, jobType: (job.jobType.name as { en: string }).en, clientName: job.clientNameEnc ? crypto.decrypt(job.clientNameEnc) : null, clientPhone: job.client ? crypto.decrypt(job.client.phoneEnc) : null } : null,
      };
    });
  }

  @Post('agent/tasks/outcome')
  @HttpCode(200)
  async outcome(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ taskId: z.string(), outcome: z.enum(['confirmed', 'disputed', 'not_reached', 'closed', 'done']), rating: z.number().int().min(1).max(5).nullable().optional() }), body);
    const task = await this.ctx.prisma.agentTask.findUniqueOrThrow({ where: { id: b.taskId } });
    if (task.kind === 'client_followup' && task.jobId && b.outcome !== 'done') {
      await recordAgentFollowUp(this.ctx, task.jobId, u.agentId!, b.outcome, b.rating ?? null);
    } else {
      await this.ctx.prisma.agentTask.update({ where: { id: task.id }, data: { status: 'done', completedAt: this.ctx.now(), assignedTo: u.agentId! } });
    }
    return { ok: true };
  }
}
