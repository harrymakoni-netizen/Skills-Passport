import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, Req, type OnModuleInit } from '@nestjs/common';
import type { Env } from '@sp/config';
import { normalisePhone, type InboundContent } from '@sp/core';
import { acceptInbound, clearSession, type ServiceContext } from '@sp/db';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../infra/auth';
import { parse } from '../infra/http';
import { CTX, ENV } from '../infra/tokens';

const FIXTURES = join(import.meta.dirname, '../../../../fixtures');

const contentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().max(4096) }),
  z.object({ kind: z.literal('choice'), id: z.string().max(200), title: z.string().max(100).optional() }),
  z.object({ kind: z.literal('media'), mediaType: z.enum(['image', 'audio', 'video']), providerMediaId: z.string(), mimeType: z.string(), durationSec: z.number().optional() }),
  z.object({ kind: z.literal('contact'), phone: z.string(), name: z.string().optional() }),
  z.object({ kind: z.literal('location'), lat: z.number(), lng: z.number() }),
]);

/**
 * WhatsApp simulator backend (development only, PROMPTS M3). Inbound messages go through exactly the same pipeline as
 * real webhooks: dedupe → queue → worker → conversation engine.
 */
@Public()
@Controller('dev')
export class DevController implements OnModuleInit {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext, @Inject(ENV) private readonly env: Env) {}

  onModuleInit() {
    if (this.env.NODE_ENV === 'production' && this.env.DEV_TOOLS) throw new Error('DEV_TOOLS must be off in production');
  }

  private mock() {
    if (!this.env.DEV_TOOLS || !this.ctx.adapters.mock) throw new NotFoundException();
    return this.ctx.adapters.mock;
  }

  @Post('mock/inbound')
  @HttpCode(200)
  async inbound(@Body() body: unknown) {
    const mock = this.mock();
    const { from, content } = parse(z.object({ from: z.string(), content: contentSchema }), body);
    const phone = normalisePhone(from);
    if (!phone) throw new NotFoundException('Bad phone');
    const msg = { providerMessageId: `sim-${randomUUID()}`, channel: 'mock' as const, from: phone, receivedAt: this.ctx.now(), content: content as InboundContent };
    await mock.store.append(phone, { id: msg.providerMessageId, direction: 'in', at: msg.receivedAt.toISOString(), inbound: msg.content });
    await acceptInbound(this.ctx, [msg]);
    return { ok: true, id: msg.providerMessageId };
  }

  /** Raw upload (body = file bytes). Returns a provider media id the simulator then sends as a media message. */
  @Post('mock/media')
  @HttpCode(200)
  async media(@Req() req: Request & { rawBody?: Buffer }) {
    const mock = this.mock();
    const body = req.rawBody;
    if (!body?.length) throw new NotFoundException('Empty file');
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream').split(';')[0]!;
    const id = await mock.channel.uploadSimulatorMedia(body, mime);
    const previewKey = `sim/${id}`;
    await this.ctx.adapters.storage.put('public', previewKey, body, { contentType: mime });
    return { providerMediaId: id, mimeType: mime, previewUrl: this.ctx.adapters.storage.publicUrl(previewKey) };
  }

  @Post('mock/fixture')
  @HttpCode(200)
  async fixture(@Body() body: unknown) {
    const mock = this.mock();
    const { path } = parse(z.object({ path: z.string().regex(/^(photos|audio)\/[a-z0-9-]+\.(jpg|wav)$/) }), body);
    const data = readFileSync(join(FIXTURES, path));
    const mime = path.endsWith('.jpg') ? 'image/jpeg' : 'audio/wav';
    const id = await mock.channel.uploadSimulatorMedia(data, mime);
    const previewKey = `sim/${id}.${path.split('.').pop()}`;
    await this.ctx.adapters.storage.put('public', previewKey, data, { contentType: mime });
    return { providerMediaId: id, mimeType: mime, previewUrl: this.ctx.adapters.storage.publicUrl(previewKey), durationSec: mime.startsWith('audio') ? Math.round((data.length - 44) / 16000) : undefined };
  }

  @Get('fixtures')
  fixtures() {
    this.mock();
    const list = (dir: string) => readdirSync(join(FIXTURES, dir)).filter((f) => /\.(jpg|wav)$/.test(f)).sort();
    return { photos: list('photos').map((f) => `photos/${f}`), audio: list('audio').filter((f) => !f.startsWith('consent')).map((f) => `audio/${f}`) };
  }

  @Get('mock/chat/:phone')
  async chat(@Param('phone') phone: string, @Query('since') since?: string) {
    const mock = this.mock();
    const p = normalisePhone(phone);
    if (!p) throw new NotFoundException();
    const entries = await mock.store.list(p, Number(since ?? 0) || 0);
    return { phone: p, entries, unreachable: await mock.store.isUnreachable(p) };
  }

  @Post('mock/unreachable')
  @HttpCode(200)
  async unreachable(@Body() body: unknown) {
    const mock = this.mock();
    const { phone, unreachable } = parse(z.object({ phone: z.string(), unreachable: z.boolean() }), body);
    const p = normalisePhone(phone);
    if (!p) throw new NotFoundException();
    await mock.store.setUnreachable(p, unreachable);
    return { ok: true };
  }

  @Post('mock/reset')
  @HttpCode(200)
  async reset(@Body() body: unknown) {
    const mock = this.mock();
    const { phones } = parse(z.object({ phones: z.array(z.string()).max(10) }), body);
    for (const raw of phones) {
      const p = normalisePhone(raw);
      if (!p) continue;
      await mock.store.clear(p);
      await clearSession(this.ctx, p);
    }
    return { ok: true };
  }

  /** Lets the demo jump the clock-dependent steps (reminders, expiry) without waiting days. */
  @Get('state')
  async state() {
    this.mock();
    const latest = await this.ctx.prisma.job.findFirst({ where: { status: { not: 'draft' } }, orderBy: { createdAt: 'desc' }, include: { artisan: true, confirmation: true } });
    return {
      latestJob: latest
        ? { ref: latest.ref, status: latest.status, passportCode: latest.artisan.passportCode, ratingUrl: latest.confirmation?.devToken ? `${this.ctx.publicBaseUrl}/c/${latest.confirmation.devToken}` : null }
        : null,
    };
  }
}
