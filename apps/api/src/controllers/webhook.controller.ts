import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Env } from '@sp/config';
import { acceptInbound, type ServiceContext } from '@sp/db';
import type { Request, Response } from 'express';
import { Public } from '../infra/auth';
import { CTX, ENV } from '../infra/tokens';

/**
 * Meta WhatsApp Cloud API webhook (SPEC 12). GET = verification handshake; POST = signed callbacks.
 * Verify signature, deduplicate by message id, queue, respond 200 immediately.
 */
@Controller('webhooks/whatsapp')
export class WebhookController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext, @Inject(ENV) private readonly env: Env) {}

  @Public()
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
    if (mode === 'subscribe' && this.env.WHATSAPP_VERIFY_TOKEN && token === this.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }) {
    const raw = { headers: req.headers, body: req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})) };
    const channel = this.ctx.adapters.channel;
    if (channel.id === 'whatsapp' && !channel.verifySignature(raw)) throw new UnauthorizedException('Bad signature');
    if (channel.id !== 'whatsapp') throw new UnauthorizedException('WhatsApp is not enabled (MESSAGING_DRIVER=mock)');
    const { messages, deliveries } = channel.parseWebhook(raw);
    await acceptInbound(this.ctx, messages);
    for (const d of deliveries) {
      await this.ctx.queue.enqueue('delivery.status', { providerMessageId: d.providerMessageId, status: d.status, ...(d.error ? { error: d.error } : {}) });
    }
    return { ok: true };
  }
}
