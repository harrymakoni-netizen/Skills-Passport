import { buildTemplate, clip, type Lang, type OutboundMessage } from '@sp/core';
import { UndeliverableError } from '@sp/adapters';
import type { ServiceContext } from './context';
import type { Recipient } from './tasks';

/** Phones that messaged us in the last 24 hours may receive free-form messages; others need templates. */
export const WINDOW_SEC = 24 * 60 * 60;
export const windowKey = (phoneHash: string) => `lastin:${phoneHash}`;

export async function markInbound(ctx: ServiceContext, phoneHash: string) {
  await ctx.kv.set(windowKey(phoneHash), String(ctx.now().getTime()), WINDOW_SEC);
}

export async function inWindow(ctx: ServiceContext, phoneHash: string) {
  return (await ctx.kv.get(windowKey(phoneHash))) !== null;
}

function mediaUrlFor(ctx: ServiceContext, m: OutboundMessage): string | undefined {
  if (m.kind !== 'media') return undefined;
  return 'url' in m.source ? m.source.url : ctx.adapters.storage.publicUrl(m.source.key);
}

export interface SendResult {
  delivered: boolean;
  undeliverable: boolean;
  providerMessageIds: string[];
}

/** Sends messages to a phone now, recording each in outbound_messages (hash only, never the number). */
export async function sendToPhone(
  ctx: ServiceContext,
  phone: string,
  messages: OutboundMessage[],
  meta: { purpose: string; relatedEntity?: string; relatedId?: string },
): Promise<SendResult> {
  const toHash = ctx.adapters.crypto.phoneHash(phone);
  const ids: string[] = [];
  for (const m of messages) {
    try {
      const url = mediaUrlFor(ctx, m);
      const { providerMessageId } = await ctx.adapters.channel.send(phone, m, url ? { mediaUrl: url } : undefined);
      ids.push(providerMessageId);
      await ctx.prisma.outboundMessage.create({
        data: {
          providerMessageId,
          toHash,
          templateName: m.kind === 'template' ? m.template : null,
          purpose: meta.purpose,
          relatedEntity: meta.relatedEntity ?? null,
          relatedId: meta.relatedId ?? null,
          status: 'sent',
        },
      });
    } catch (err) {
      if (err instanceof UndeliverableError) {
        await ctx.prisma.outboundMessage.create({
          data: { toHash, purpose: meta.purpose, relatedEntity: meta.relatedEntity ?? null, relatedId: meta.relatedId ?? null, status: 'undeliverable', error: 'not on WhatsApp', templateName: m.kind === 'template' ? m.template : null },
        });
        return { delivered: false, undeliverable: true, providerMessageIds: ids };
      }
      throw err;
    }
  }
  return { delivered: true, undeliverable: false, providerMessageIds: ids };
}

export async function resolveRecipient(ctx: ServiceContext, r: Recipient): Promise<{ phone: string; lang: Lang; phoneHash: string } | null> {
  const { crypto } = ctx.adapters;
  if (r.kind === 'artisan') {
    const a = await ctx.prisma.artisan.findUnique({ where: { id: r.id }, include: { pii: true } });
    if (!a?.pii || a.status === 'deleted') return null;
    return { phone: crypto.decrypt(a.pii.phoneEnc), lang: a.language, phoneHash: a.pii.phoneHash };
  }
  if (r.kind === 'client') {
    const c = await ctx.prisma.client.findUnique({ where: { id: r.id } });
    if (!c || c.optedOut) return null;
    return { phone: crypto.decrypt(c.phoneEnc), lang: c.language, phoneHash: c.phoneHash };
  }
  const b = await ctx.prisma.buyer.findUnique({ where: { id: r.id } });
  if (!b) return null;
  return { phone: crypto.decrypt(b.contactPhoneEnc), lang: 'en', phoneHash: b.contactPhoneHash };
}

/**
 * Queues a notification. Messages are built per language by `build`, after the recipient's language is known.
 * Outside the 24-hour window, free-form artisan messages are wrapped in the `artisan_job_update` template.
 */
export async function notify(
  ctx: ServiceContext,
  recipient: Recipient,
  messages: OutboundMessage[] | ((lang: Lang) => OutboundMessage[]),
  meta: { purpose: string; relatedEntity?: string; relatedId?: string; ref?: string },
) {
  // Messages are rendered when the task runs so language changes are respected; we serialise a builder result per lang.
  const perLang = typeof messages === 'function' ? { en: messages('en'), sn: messages('sn'), nd: messages('nd') } : { en: messages, sn: messages, nd: messages };
  await ctx.queue.enqueue('outbound.send', {
    recipient,
    messages: [perLang],
    purpose: meta.purpose,
    ...(meta.relatedEntity ? { relatedEntity: meta.relatedEntity } : {}),
    ...(meta.relatedId ? { relatedId: meta.relatedId } : {}),
    ...(meta.ref ? { ref: meta.ref } : {}),
  });
}

/** Handler for the `outbound.send` task. */
export async function runOutbound(
  ctx: ServiceContext,
  task: { recipient: Recipient; messages: unknown[]; purpose: string; relatedEntity?: string; relatedId?: string; ref?: string },
) {
  const to = await resolveRecipient(ctx, task.recipient);
  if (!to) return;
  const perLang = task.messages[0] as Record<Lang, OutboundMessage[]>;
  let msgs = perLang[to.lang] ?? perLang.en;
  if (task.recipient.kind === 'artisan' && !(await inWindow(ctx, to.phoneHash))) {
    msgs = msgs.map((m) => {
      if (m.kind === 'template' || m.kind === 'media') return m;
      const body = m.kind === 'text' ? m.text : m.body;
      return buildTemplate('artisan_job_update', to.lang, [task.ref ?? 'Skills Passport', clip(body.replace(/\*/g, ''), 900)]);
    });
  }
  await sendToPhone(ctx, to.phone, msgs, task);
}
