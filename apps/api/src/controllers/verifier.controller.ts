import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { endorseArtisan, requestDemonstration, reviewDetail, reviewQueue, submitReview, withdrawEndorsement, type ServiceContext } from '@sp/db';
import { z } from 'zod';
import { Roles } from '../infra/auth';
import { CurrentUser, parse, type SessionUser } from '../infra/http';
import { CTX } from '../infra/tokens';

const reviewBody = z.object({
  quality: z.enum(['meets', 'needs_improvement', 'reject']),
  confirmedUnitIds: z.array(z.string()).max(30),
  removedUnitIds: z.array(z.string()).max(30),
  note: z.string().max(600).nullable().optional(),
});

/** SPEC 4.4 / 12 — verifier endpoints. Conflicts of interest and trade scope are enforced in the services. */
@Roles('verifier')
@Controller()
export class VerifierController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  @Get('reviews/queue')
  queue(@CurrentUser() u: SessionUser, @Query('trade') trade?: string, @Query('flagged') flagged?: string) {
    return reviewQueue(this.ctx, u.verifierId!, { ...(trade ? { tradeId: trade } : {}), flaggedOnly: flagged === '1' });
  }

  @Get('reviews/jobs/:id')
  detail(@CurrentUser() u: SessionUser, @Param('id') id: string) {
    return reviewDetail(this.ctx, u.verifierId!, id);
  }

  @Post('jobs/:id/review')
  @HttpCode(200)
  review(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(reviewBody, body);
    return submitReview(this.ctx, u.verifierId!, id, { ...b, note: b.note ?? null });
  }

  @Post('jobs/:id/demonstration')
  @HttpCode(200)
  async demo(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const { note } = parse(z.object({ note: z.string().max(400).optional() }), body);
    await requestDemonstration(this.ctx, u.verifierId!, id, note);
    return { ok: true };
  }

  @Post('artisans/:id/endorse')
  @HttpCode(200)
  async endorse(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const b = parse(z.object({ tradeId: z.string().optional(), jobId: z.string().optional(), statement: z.string().min(20).max(400) }), body);
    const tradeId = b.tradeId ?? (b.jobId ? (await this.ctx.prisma.job.findUniqueOrThrow({ where: { id: b.jobId }, select: { tradeId: true } })).tradeId : null);
    if (!tradeId) throw Object.assign(new Error('tradeId or jobId is required'), { status: 400 });
    const e = await endorseArtisan(this.ctx, u.verifierId!, id, tradeId, b.statement);
    return { id: e.id };
  }

  @Post('endorsements/:id/withdraw')
  @HttpCode(200)
  async withdraw(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const { reason } = parse(z.object({ reason: z.string().min(3).max(300) }), body);
    await withdrawEndorsement(this.ctx, { verifierId: u.verifierId! }, id, reason);
    return { ok: true };
  }

  @Get('reviews/mine')
  async mine(@CurrentUser() u: SessionUser) {
    const v = await this.ctx.prisma.verifier.findUniqueOrThrow({ where: { id: u.verifierId! }, include: { trades: { include: { trade: true } } } });
    const start = new Date(this.ctx.now());
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const [month, total, endorsements, recent] = await Promise.all([
      this.ctx.prisma.review.count({ where: { verifierId: v.id, createdAt: { gte: start } } }),
      this.ctx.prisma.review.count({ where: { verifierId: v.id } }),
      this.ctx.prisma.endorsement.findMany({ where: { verifierId: v.id }, include: { artisan: { select: { displayName: true, passportCode: true } }, trade: true }, orderBy: { createdAt: 'desc' } }),
      this.ctx.prisma.review.findMany({ where: { verifierId: v.id }, include: { job: { select: { ref: true, artisan: { select: { displayName: true } } } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return {
      name: v.name,
      trades: v.trades.map((t) => ({ id: t.tradeId, code: t.trade.code, name: t.trade.nameEn })),
      reviewsThisMonth: month,
      reviewsTotal: total,
      endorsements: endorsements.map((e) => ({ id: e.id, artisan: e.artisan, trade: e.trade.nameEn, statement: e.statement, createdAt: e.createdAt, withdrawnAt: e.withdrawnAt })),
      recent: recent.map((r) => ({ id: r.id, ref: r.job.ref, artisan: r.job.artisan.displayName, quality: r.quality, createdAt: r.createdAt })),
    };
  }
}
