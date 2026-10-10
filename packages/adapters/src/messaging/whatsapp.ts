import { createHmac } from 'node:crypto';
import type { DeliveryEvent, InboundContent, InboundMessage, Lang, OutboundMessage, TemplateSubmission } from '@sp/core';
import { safeEqual } from '../crypto';
import { WHATSAPP_CAPABILITIES, type MessagingChannel, type RawWebhook } from './types';

export interface WhatsAppConfig {
  graphUrl: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  /** WhatsApp Business Account id (template management). */
  businessAccountId?: string;
  /** Resolves storage keys to public URLs for media messages. */
  mediaUrl: (key: string) => string;
  fetchImpl?: typeof fetch;
}

/**
 * Meta does not offer chiShona or isiNdebele as template languages. Those variants are registered under the "en"
 * locale with a language suffix on the template name (see docs/WHATSAPP_TEMPLATES.md).
 */
export function templateNameAndLocale(name: string, lang: Lang): { name: string; code: string } {
  return lang === 'en' ? { name, code: 'en' } : { name: `${name}_${lang}`, code: 'en' };
}

/** Renders a neutral message as a WhatsApp Cloud API request body. Exported for tests. */
export function renderWhatsApp(to: string, m: OutboundMessage, mediaUrl: (key: string) => string): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, '') };
  switch (m.kind) {
    case 'text':
      return { ...base, type: 'text', text: { body: m.text, preview_url: true } };
    case 'buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: m.body },
          ...(m.footer ? { footer: { text: m.footer } } : {}),
          action: { buttons: m.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
        },
      };
    case 'list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: m.body },
          ...(m.footer ? { footer: { text: m.footer } } : {}),
          action: {
            button: m.buttonLabel,
            sections: m.sections.map((s) => ({
              ...(s.title ? { title: s.title } : {}),
              rows: s.rows.map((r) => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })),
            })),
          },
        },
      };
    case 'media': {
      const link = 'url' in m.source ? m.source.url : mediaUrl(m.source.key);
      const payload: Record<string, unknown> = { link };
      if (m.caption && m.mediaType !== 'audio') payload.caption = m.caption;
      if (m.filename && m.mediaType === 'document') payload.filename = m.filename;
      return { ...base, type: m.mediaType, [m.mediaType]: payload };
    }
    case 'template': {
      const { name, code } = templateNameAndLocale(m.template, m.lang);
      return {
        ...base,
        type: 'template',
        template: {
          name,
          language: { code },
          components: [
            { type: 'body', parameters: m.params.map((text) => ({ type: 'text', text })) },
            ...m.buttons.map((b, index) => ({
              type: 'button',
              sub_type: 'quick_reply',
              index: String(index),
              parameters: [{ type: 'payload', payload: b.id }],
            })),
          ],
        },
      };
    }
  }
}

interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { payload: string; text: string };
  image?: { id: string; mime_type: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  video?: { id: string; mime_type: string };
  contacts?: { phones?: { phone?: string; wa_id?: string }[]; name?: { formatted_name?: string } }[];
  location?: { latitude: number; longitude: number };
}

interface WaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: { code: number; title: string }[];
}

export interface RegisteredTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  rejected_reason?: string;
}

/** Error codes that mean the recipient can't be reached on WhatsApp. */
const UNDELIVERABLE_CODES = new Set([131026, 131000, 131047]);

export class WhatsAppCloudChannel implements MessagingChannel {
  readonly id = 'whatsapp' as const;
  readonly capabilities = WHATSAPP_CAPABILITIES;
  private readonly fetch: typeof fetch;
  constructor(private readonly cfg: WhatsAppConfig) {
    this.fetch = cfg.fetchImpl ?? fetch;
  }

  async send(to: string, message: OutboundMessage) {
    const res = await this.fetch(`${this.cfg.graphUrl}/${this.cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(renderWhatsApp(to, message, this.cfg.mediaUrl)),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (!res.ok || !json.messages?.[0]) {
      const err = new Error(`WhatsApp send failed (${res.status}): ${json.error?.message ?? 'unknown error'}`);
      (err as Error & { code?: number; retryable?: boolean }).code = json.error?.code;
      (err as Error & { retryable?: boolean }).retryable = res.status >= 500 || res.status === 429;
      throw err;
    }
    return { providerMessageId: json.messages[0].id };
  }

  async downloadMedia(providerMediaId: string) {
    const auth = { Authorization: `Bearer ${this.cfg.accessToken}` };
    const meta = await this.fetch(`${this.cfg.graphUrl}/${providerMediaId}`, { headers: auth });
    if (!meta.ok) throw new Error(`WhatsApp media lookup failed (${meta.status})`);
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await this.fetch(url, { headers: auth });
    if (!file.ok) throw new Error(`WhatsApp media download failed (${file.status})`);
    return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
  }

  /** Message templates registered on the WhatsApp Business Account, with Meta's review status. */
  async listTemplates(): Promise<RegisteredTemplate[]> {
    const waba = this.requireWaba();
    const out: RegisteredTemplate[] = [];
    let url: string | undefined = `${this.cfg.graphUrl}/${waba}/message_templates?fields=name,language,status,category,rejected_reason&limit=100`;
    while (url) {
      const res = await this.fetch(url, { headers: { Authorization: `Bearer ${this.cfg.accessToken}` } });
      const json = (await res.json().catch(() => ({}))) as { data?: RegisteredTemplate[]; paging?: { next?: string }; error?: { message?: string } };
      if (!res.ok) throw new Error(`WhatsApp template list failed (${res.status}): ${json.error?.message ?? 'unknown error'}`);
      out.push(...(json.data ?? []));
      url = json.paging?.next;
    }
    return out;
  }

  /** Submits one template for Meta's review. */
  async createTemplate(t: TemplateSubmission): Promise<{ id: string; status: string }> {
    const waba = this.requireWaba();
    const res = await this.fetch(`${this.cfg.graphUrl}/${waba}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t.name, language: t.language, category: t.category, components: t.components }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string; error_user_msg?: string } };
    if (!res.ok || !json.id) throw new Error(json.error?.error_user_msg ?? json.error?.message ?? `HTTP ${res.status}`);
    return { id: json.id, status: json.status ?? 'PENDING' };
  }

  private requireWaba(): string {
    if (!this.cfg.businessAccountId) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not set');
    return this.cfg.businessAccountId;
  }

  verifySignature(raw: RawWebhook): boolean {
    const header = raw.headers['x-hub-signature-256'];
    const sig = Array.isArray(header) ? header[0] : header;
    if (!sig || !this.cfg.appSecret) return false;
    const expected = `sha256=${createHmac('sha256', this.cfg.appSecret).update(raw.body).digest('hex')}`;
    return safeEqual(sig, expected);
  }

  parseWebhook(raw: RawWebhook): { messages: InboundMessage[]; deliveries: DeliveryEvent[] } {
    const body = JSON.parse(raw.body.toString('utf8')) as {
      entry?: { changes?: { value?: { messages?: WaMessage[]; statuses?: WaStatus[] } }[] }[];
    };
    const messages: InboundMessage[] = [];
    const deliveries: DeliveryEvent[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          messages.push({
            providerMessageId: m.id,
            channel: 'whatsapp',
            from: `+${m.from.replace(/^\+/, '')}`,
            receivedAt: new Date(Number(m.timestamp) * 1000),
            content: parseContent(m),
          });
        }
        for (const s of change.value?.statuses ?? []) {
          const undeliverable = s.status === 'failed' && (s.errors ?? []).some((e) => UNDELIVERABLE_CODES.has(e.code));
          deliveries.push({
            providerMessageId: s.id,
            status: undeliverable ? 'undeliverable' : s.status,
            ...(s.errors?.[0] ? { error: `${s.errors[0].code} ${s.errors[0].title}` } : {}),
            at: new Date(Number(s.timestamp) * 1000),
          });
        }
      }
    }
    return { messages, deliveries };
  }
}

function parseContent(m: WaMessage): InboundContent {
  switch (m.type) {
    case 'text':
      return { kind: 'text', text: m.text?.body ?? '' };
    case 'interactive': {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return r ? { kind: 'choice', id: r.id, title: r.title } : { kind: 'unsupported' };
    }
    case 'button':
      return m.button ? { kind: 'choice', id: m.button.payload, title: m.button.text } : { kind: 'unsupported' };
    case 'image':
      return m.image ? { kind: 'media', mediaType: 'image', providerMediaId: m.image.id, mimeType: m.image.mime_type } : { kind: 'unsupported' };
    case 'audio':
      return m.audio ? { kind: 'media', mediaType: 'audio', providerMediaId: m.audio.id, mimeType: m.audio.mime_type } : { kind: 'unsupported' };
    case 'video':
      return m.video ? { kind: 'media', mediaType: 'video', providerMediaId: m.video.id, mimeType: m.video.mime_type } : { kind: 'unsupported' };
    case 'contacts': {
      const c = m.contacts?.[0];
      const phone = c?.phones?.[0]?.phone ?? c?.phones?.[0]?.wa_id;
      return phone ? { kind: 'contact', phone, ...(c?.name?.formatted_name ? { name: c.name.formatted_name } : {}) } : { kind: 'unsupported' };
    }
    case 'location':
      return m.location ? { kind: 'location', lat: m.location.latitude, lng: m.location.longitude } : { kind: 'unsupported' };
    default:
      return { kind: 'unsupported' };
  }
}
