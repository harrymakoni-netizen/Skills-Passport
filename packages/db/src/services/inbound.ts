import { handleInbound, t, type InboundMessage, type Session } from '@sp/core';
import type { ServiceContext } from './context';
import { markInbound, sendToPhone } from './outbound';
import { createFlowPorts } from './ports';

const SESSION_TTL = 24 * 60 * 60;
const sessionKey = (phoneHash: string) => `session:${phoneHash}`;

/** Deduplicate by provider message id (webhook rule). Returns false if already seen. */
export async function recordInbound(ctx: ServiceContext, msg: { providerMessageId: string; channel: string; from: string }): Promise<boolean> {
  try {
    await ctx.prisma.inboundMessage.create({
      data: { providerMessageId: msg.providerMessageId, channel: msg.channel, fromHash: ctx.adapters.crypto.phoneHash(msg.from), receivedAt: ctx.now() },
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return false;
    throw err;
  }
}

/**
 * Runs one inbound message through the conversation engine: per-phone lock, session from Redis (24 h TTL, so an
 * interrupted job can be resumed), flow logic from packages/core, replies sent through the MessagingChannel.
 */
export async function processInbound(ctx: ServiceContext, msg: InboundMessage) {
  const phoneHash = ctx.adapters.crypto.phoneHash(msg.from);
  let release: (() => Promise<void>) | null = null;
  for (let i = 0; i < 50 && !release; i++) {
    release = await ctx.kv.lock(`lock:${phoneHash}`, 30_000);
    if (!release) await new Promise((r) => setTimeout(r, 100));
  }
  try {
    await markInbound(ctx, phoneHash);
    const raw = await ctx.kv.get(sessionKey(phoneHash));
    const session = raw ? (JSON.parse(raw) as Session) : null;
    const { params } = await ctx.config();
    let result;
    try {
      result = await handleInbound(createFlowPorts(ctx, { config: params }), session, msg);
    } catch (err) {
      ctx.log.error({ err: (err as Error).message, stack: (err as Error).stack?.split('\n').slice(0, 4).join(' | ') }, 'conversation error');
      await sendToPhone(ctx, msg.from, [{ kind: 'text', text: t(session?.lang ?? 'en', 'common.error') }], { purpose: 'conversation_error' });
      return;
    }
    if (result.session) await ctx.kv.set(sessionKey(phoneHash), JSON.stringify(result.session), SESSION_TTL);
    else await ctx.kv.del(sessionKey(phoneHash));
    if (result.out.length) await sendToPhone(ctx, msg.from, result.out, { purpose: 'conversation' });
    await ctx.prisma.inboundMessage.updateMany({ where: { providerMessageId: msg.providerMessageId }, data: { processedAt: ctx.now() } });
  } finally {
    await release?.();
  }
}

export async function clearSession(ctx: ServiceContext, phone: string) {
  await ctx.kv.del(sessionKey(ctx.adapters.crypto.phoneHash(phone)));
}
