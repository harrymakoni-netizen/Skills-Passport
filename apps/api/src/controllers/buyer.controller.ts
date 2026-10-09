import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { createWorkRequest, searchDirectory, type ServiceContext } from '@sp/db';
import { z } from 'zod';
import { Roles } from '../infra/auth';
import { CurrentUser, parse, rateLimit, type SessionUser } from '../infra/http';
import { CTX } from '../infra/tokens';

/** SPEC 4.7 buyers: directory search and work requests. Contacts are exchanged only after the artisan accepts. */
@Roles('buyer')
@Controller()
export class BuyerController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  @Get('directory')
  async directory(@CurrentUser() u: SessionUser, @Query() query: Record<string, string>) {
    await rateLimit(this.ctx, `bdir:${u.id}`, 120, 300);
    return searchDirectory(this.ctx, {
      ...(query.trade ? { trade: query.trade } : {}),
      ...(query.area ? { area: query.area } : {}),
      ...(query.level ? { level: query.level as 'bronze' } : {}),
      ...(query.minRating ? { minRating: Number(query.minRating) } : {}),
      page: Number(query.page ?? 1) || 1,
      pageSize: 20,
    });
  }

  @Post('work-requests')
  @HttpCode(200)
  async create(@CurrentUser() u: SessionUser, @Body() body: unknown) {
    await rateLimit(this.ctx, `wr:${u.id}`, 20, 3600);
    const b = parse(z.object({ passportCode: z.string(), description: z.string().min(10).max(500), areaId: z.string(), preferredDates: z.string().min(2).max(120) }), body);
    const wr = await createWorkRequest(this.ctx, { buyerId: u.buyerId!, artisanCode: b.passportCode, description: b.description, areaId: b.areaId, preferredDates: b.preferredDates });
    return { id: wr.id };
  }

  @Get('work-requests')
  async list(@CurrentUser() u: SessionUser) {
    const rows = await this.ctx.prisma.workRequest.findMany({ where: { buyerId: u.buyerId! }, include: { artisan: { include: { pii: true, trades: { include: { trade: true } } } }, area: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({
      id: r.id,
      artisan: { displayName: r.artisan.displayName, passportCode: r.artisan.passportCode, trade: r.artisan.trades[0]?.trade.nameEn ?? '' },
      description: r.description,
      area: r.area.name,
      preferredDates: r.preferredDates,
      status: r.status,
      outcome: r.buyerOutcome,
      createdAt: r.createdAt,
      // SPEC 3: buyers see the phone number only after the artisan accepts.
      artisanPhone: r.status === 'accepted' && r.artisan.pii ? this.ctx.adapters.crypto.decrypt(r.artisan.pii.phoneEnc) : null,
    }));
  }

  @Post('work-requests/:id/outcome')
  @HttpCode(200)
  async outcome(@CurrentUser() u: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    const { hired } = parse(z.object({ hired: z.boolean() }), body);
    await this.ctx.prisma.workRequest.updateMany({ where: { id, buyerId: u.buyerId!, status: 'accepted' }, data: { buyerOutcome: hired ? 'hired' : 'not_hired' } });
    return { ok: true };
  }
}
