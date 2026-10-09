import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { isLang, isPassportCode } from '@sp/core';
import {
  event,
  getConfirmationPage,
  getPublicPassport,
  listAreas,
  listTrades,
  passportCardPng,
  passportOgPng,
  passportQrPng,
  searchDirectory,
  submitConfirmationPage,
  type ServiceContext,
} from '@sp/db';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Public } from '../infra/auth';
import { clientIp, parse, rateLimit } from '../infra/http';
import { CTX } from '../infra/tokens';

const confirmBody = z.object({
  response: z.enum(['confirmed', 'disputed', 'stop']),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});

const directoryQuery = z.object({
  trade: z.string().max(8).optional(),
  area: z.string().max(40).optional(),
  level: z.enum(['starter', 'bronze', 'silver', 'gold']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().min(1).max(50).optional(),
});

@Public()
@Controller('public')
export class PublicController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  @Get('reference')
  async reference() {
    const trades = await listTrades(this.ctx);
    const areas = await this.ctx.prisma.area.findMany({ where: { active: true }, orderBy: [{ city: 'desc' }, { name: 'asc' }], select: { id: true, name: true, city: true, cityCode: true } });
    return { trades, areas };
  }

  @Get('areas/:cityCode')
  areas(@Param('cityCode') cityCode: string) {
    return listAreas(this.ctx, cityCode);
  }

  @Get('passports/:code')
  async passport(@Param('code') code: string, @Query('view') view: string | undefined, @Req() req: Request) {
    if (!isPassportCode(code)) throw new NotFoundException('Passport not found');
    const p = await getPublicPassport(this.ctx, code);
    if (!p) throw new NotFoundException('Passport not found');
    if (view === '1') {
      const key = `pv:${code}:${clientIp(req)}`;
      if ((await this.ctx.kv.get(key)) === null) {
        await this.ctx.kv.set(key, '1', 3600);
        const a = await this.ctx.prisma.artisan.findUnique({ where: { passportCode: code }, select: { id: true } });
        if (a) await event(this.ctx, 'passport_viewed', a.id);
      }
    }
    return p;
  }

  @Get('passports/:code/qr.png')
  async qr(@Param('code') code: string, @Res() res: Response) {
    if (!isPassportCode(code) || !(await this.ctx.prisma.artisan.findFirst({ where: { passportCode: code, status: { not: 'deleted' } } }))) throw new NotFoundException();
    const png = await passportQrPng(this.ctx, code);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }).send(png);
  }

  @Get('passports/:code/card.png')
  async card(@Param('code') code: string, @Query('lang') lang: string | undefined, @Res() res: Response) {
    if (!isPassportCode(code)) throw new NotFoundException();
    const png = await passportCardPng(this.ctx, code, isLang(lang) ? lang : 'en');
    if (!png) throw new NotFoundException();
    const a = await this.ctx.prisma.artisan.findUnique({ where: { passportCode: code }, select: { id: true } });
    if (a) await event(this.ctx, 'passport_shared', a.id, { asset: 'card' });
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=600' }).send(png);
  }

  @Get('passports/:code/og.png')
  async og(@Param('code') code: string, @Res() res: Response) {
    if (!isPassportCode(code)) throw new NotFoundException();
    const png = await passportOgPng(this.ctx, code);
    if (!png) throw new NotFoundException();
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' }).send(png);
  }

  @Get('confirmations/:token')
  async confirmation(@Param('token') token: string, @Req() req: Request) {
    await rateLimit(this.ctx, `conf:${clientIp(req)}`, 60, 600);
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { state: 'invalid' };
    return getConfirmationPage(this.ctx, token);
  }

  @Post('confirmations/:token')
  async submit(@Param('token') token: string, @Body() body: unknown, @Req() req: Request) {
    await rateLimit(this.ctx, `confpost:${clientIp(req)}`, 20, 600);
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, state: 'invalid' };
    return submitConfirmationPage(this.ctx, token, parse(confirmBody, body));
  }

  /** Public, limited directory (SPEC 12 "Buyer, public (limited)"): paginated and rate-limited against scraping. */
  @Get('directory')
  async directory(@Query() query: unknown, @Req() req: Request) {
    await rateLimit(this.ctx, `dir:${clientIp(req)}`, 60, 300);
    const q = parse(directoryQuery, query);
    return searchDirectory(this.ctx, { ...q, pageSize: 12 });
  }
}
