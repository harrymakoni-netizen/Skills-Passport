import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { normalisePhone } from '@sp/core';
import {
  audit,
  createConfigVersion,
  createStaffUser,
  listConfigs,
  listFlags,
  overview,
  pilotReport,
  resolveDispute,
  resolveFlag,
  setFrozen,
  verifierMonthlyCounts,
  withdrawEndorsement,
  type ServiceContext,
} from '@sp/db';
import { z } from 'zod';
import { Roles } from '../infra/auth';
import { CurrentUser, parse, type SessionUser } from '../infra/http';
import { CTX } from '../infra/tokens';

const localized = z.object({ en: z.string().min(1).max(120), sn: z.string().max(120).optional(), nd: z.string().max(120).optional() });

@Roles('admin')
@Controller()
export class AdminController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  @Get('admin/overview')
  overview() {
    return overview(this.ctx);
  }

  // ---------------------------------------------------------------- fraud review
  @Get('admin/flags')
  flags(@Query('status') status?: string) {
    return listFlags(this.ctx, status === 'upheld' || status === 'cleared' ? status : 'open');
  }

  @Post('admin/flags/:id/resolve')
  @HttpCode(200)
  async resolve(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ decision: z.enum(['uphold', 'clear']), note: z.string().min(3).max(500), rejectJob: z.boolean().optional(), freezeArtisan: z.boolean().optional() }), body);
    await resolveFlag(this.ctx, u.id, id, b);
    return { ok: true };
  }

  @Post('admin/jobs/:id/resolve-dispute')
  @HttpCode(200)
  async dispute(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ forArtisan: z.boolean(), note: z.string().min(3).max(500) }), body);
    await resolveDispute(this.ctx, u.id, id, b.forArtisan, b.note);
    return { ok: true };
  }

  // ---------------------------------------------------------------- artisans
  @Get('admin/artisans')
  async artisans(@Query('q') q?: string) {
    const rows = await this.ctx.prisma.artisan.findMany({
      where: { status: { not: 'deleted' }, ...(q ? { OR: [{ passportCode: { contains: q.toUpperCase() } }, { displayName: { contains: q, mode: 'insensitive' } }] } : {}) },
      include: { area: true, trades: { include: { trade: true } }, _count: { select: { jobs: true } } },
      orderBy: { joinedAt: 'desc' },
      take: 200,
    });
    return rows.map((a) => ({
      id: a.id,
      passportCode: a.passportCode,
      displayName: a.displayName,
      level: a.level,
      status: a.status,
      levelFrozen: a.levelFrozen,
      trustScore: a.trustScore,
      area: a.area.name,
      city: a.area.city,
      trades: a.trades.map((t) => t.trade.code),
      jobs: a._count.jobs,
      joinedAt: a.joinedAt,
    }));
  }

  @Post('admin/artisans/:id/freeze')
  @HttpCode(200)
  async freeze(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const { frozen } = parse(z.object({ frozen: z.boolean() }), body);
    await setFrozen(this.ctx, u.id, id, frozen);
    return { ok: true };
  }

  @Post('admin/endorsements/:id/withdraw')
  @HttpCode(200)
  async withdraw(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const { reason } = parse(z.object({ reason: z.string().min(3).max(300) }), body);
    await withdrawEndorsement(this.ctx, { adminUserId: u.id }, id, reason);
    return { ok: true };
  }

  // ---------------------------------------------------------------- config (versioned, never edited in place)
  @Get('admin/config')
  configs() {
    return listConfigs(this.ctx);
  }

  @Put('admin/config')
  async putConfig(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ params: z.unknown(), note: z.string().min(3).max(300) }), body);
    return createConfigVersion(this.ctx, u.id, b.params, b.note);
  }

  // ---------------------------------------------------------------- competency frameworks
  @Get('admin/trades')
  trades() {
    return this.ctx.prisma.trade.findMany({
      orderBy: { code: 'asc' },
      include: { units: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }, jobTypes: { orderBy: { sortOrder: 'asc' }, include: { units: { include: { unit: { select: { code: true } } } } } } },
    });
  }

  @Post('admin/trades')
  @HttpCode(200)
  async createTrade(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ code: z.string().regex(/^[A-Z]{3}$/), nameEn: z.string().min(2), nameSn: z.string().min(2), nameNd: z.string().min(2) }), body);
    const t = await this.ctx.prisma.trade.create({ data: b });
    await audit(this.ctx, u.id, 'trade.create', 'trade', t.id, b);
    return t;
  }

  @Patch('admin/trades/:id')
  async updateTrade(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ nameEn: z.string().min(2).optional(), nameSn: z.string().min(2).optional(), nameNd: z.string().min(2).optional(), active: z.boolean().optional() }), body);
    const t = await this.ctx.prisma.trade.update({ where: { id }, data: b });
    await audit(this.ctx, u.id, 'trade.update', 'trade', id, b);
    return t;
  }

  @Post('admin/units')
  @HttpCode(200)
  async createUnit(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ tradeId: z.string(), code: z.string().regex(/^[A-Z]{3}-\d{2}$/), title: localized, description: z.string().min(5), evidenceGuidance: z.string().min(5), classLevel: z.string().optional(), standardRef: z.string().optional() }), body);
    const unit = await this.ctx.prisma.competencyUnit.create({ data: { ...b, title: { en: b.title.en, sn: b.title.sn ?? b.title.en, nd: b.title.nd ?? b.title.en } } });
    await audit(this.ctx, u.id, 'unit.create', 'competency_unit', unit.id, { code: b.code });
    return unit;
  }

  @Patch('admin/units/:id')
  async updateUnit(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ title: localized.optional(), description: z.string().min(5).optional(), evidenceGuidance: z.string().min(5).optional(), classLevel: z.string().nullable().optional(), standardRef: z.string().nullable().optional(), active: z.boolean().optional() }), body);
    const unit = await this.ctx.prisma.competencyUnit.update({ where: { id }, data: { ...b, ...(b.title ? { title: { en: b.title.en, sn: b.title.sn ?? b.title.en, nd: b.title.nd ?? b.title.en } } : {}) } });
    await audit(this.ctx, u.id, 'unit.update', 'competency_unit', id, b);
    return unit;
  }

  @Post('admin/job-types')
  @HttpCode(200)
  async createJobType(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ tradeId: z.string(), key: z.string().regex(/^[a-z0-9_]{3,60}$/), name: localized, needsBeforePhoto: z.boolean(), unitIds: z.array(z.string()) }), body);
    const jt = await this.ctx.prisma.jobType.create({
      data: { tradeId: b.tradeId, key: b.key, name: { en: b.name.en, sn: b.name.sn ?? b.name.en, nd: b.name.nd ?? b.name.en }, needsBeforePhoto: b.needsBeforePhoto, units: { create: b.unitIds.map((unitId) => ({ unitId })) } },
    });
    await audit(this.ctx, u.id, 'job_type.create', 'job_type', jt.id, { key: b.key });
    return jt;
  }

  @Patch('admin/job-types/:id')
  async updateJobType(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ name: localized.optional(), needsBeforePhoto: z.boolean().optional(), active: z.boolean().optional(), unitIds: z.array(z.string()).optional() }), body);
    if (b.unitIds) {
      await this.ctx.prisma.jobTypeUnit.deleteMany({ where: { jobTypeId: id } });
      await this.ctx.prisma.jobTypeUnit.createMany({ data: b.unitIds.map((unitId) => ({ jobTypeId: id, unitId })) });
    }
    const jt = await this.ctx.prisma.jobType.update({
      where: { id },
      data: { ...(b.needsBeforePhoto !== undefined ? { needsBeforePhoto: b.needsBeforePhoto } : {}), ...(b.active !== undefined ? { active: b.active } : {}), ...(b.name ? { name: { en: b.name.en, sn: b.name.sn ?? b.name.en, nd: b.name.nd ?? b.name.en } } : {}) },
    });
    await audit(this.ctx, u.id, 'job_type.update', 'job_type', id, b);
    return jt;
  }

  // ---------------------------------------------------------------- people
  @Get('admin/staff')
  async staff() {
    const [verifiers, agents, counts] = await Promise.all([
      this.ctx.prisma.verifier.findMany({ include: { trades: { include: { trade: true } }, area: true, user: { select: { lastLoginAt: true, active: true } }, conflicts: true, _count: { select: { reviews: true, endorsements: true } } }, orderBy: { name: 'asc' } }),
      this.ctx.prisma.fieldAgent.findMany({ include: { area: true, user: { select: { lastLoginAt: true, active: true } }, _count: { select: { jobs: true, enrolled: true } } }, orderBy: { name: 'asc' } }),
      verifierMonthlyCounts(this.ctx),
    ]);
    return {
      verifiers: verifiers.map((v) => ({ id: v.id, name: v.name, status: v.status, trades: v.trades.map((t) => t.trade.code), area: v.area?.name ?? null, yearsExperience: v.yearsExperience, reviews: v._count.reviews, endorsements: v._count.endorsements, conflicts: v.conflicts.length, lastLoginAt: v.user.lastLoginAt })),
      agents: agents.map((a) => ({ id: a.id, name: a.name, area: a.area?.name ?? null, active: a.active, jobsLogged: a._count.jobs, enrolled: a._count.enrolled, lastLoginAt: a.user.lastLoginAt })),
      verifierMonthly: counts,
    };
  }

  @Post('admin/staff')
  @HttpCode(200)
  async createStaff(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    const b = parse(z.object({ role: z.enum(['verifier', 'agent', 'admin']), name: z.string().min(3).max(80), email: z.string().email(), phone: z.string(), password: z.string().min(10).max(200), tradeIds: z.array(z.string()).optional(), areaId: z.string().optional(), yearsExperience: z.number().int().min(0).max(60).optional() }), body);
    const phone = normalisePhone(b.phone);
    if (!phone) throw Object.assign(new Error('Phone number is not valid'), { status: 400 });
    const user = await createStaffUser(this.ctx, u.id, { ...b, phone });
    return { id: user.id };
  }

  @Post('admin/verifiers/:id/conflicts')
  @HttpCode(200)
  async conflict(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ passportCode: z.string(), reason: z.string().min(3).max(200) }), body);
    const a = await this.ctx.prisma.artisan.findUniqueOrThrow({ where: { passportCode: b.passportCode } });
    await this.ctx.prisma.verifierConflict.upsert({ where: { verifierId_artisanId: { verifierId: id, artisanId: a.id } }, create: { verifierId: id, artisanId: a.id, reason: b.reason }, update: { reason: b.reason } });
    await audit(this.ctx, u.id, 'verifier.conflict', 'verifier', id, { artisanId: a.id });
    return { ok: true };
  }

  // ---------------------------------------------------------------- audit, reports
  @Get('admin/audit')
  async auditLog(@Query('entity') entity?: string) {
    const rows = await this.ctx.prisma.auditLog.findMany({ where: entity ? { entity } : {}, orderBy: { at: 'desc' }, take: 300 });
    const actors = await this.ctx.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true, role: true } });
    return rows.map((r) => ({ ...r, actor: actors.find((a) => a.id === r.actorId) ?? null }));
  }

  @Get('reports/pilot')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    const end = to ? new Date(to) : this.ctx.now();
    const start = from ? new Date(from) : new Date(end.getTime() - 365 * 86400000);
    return pilotReport(this.ctx, start, end);
  }
}
