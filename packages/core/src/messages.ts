/** Channel-neutral message model (PLAN §4). Flow code only produces and consumes these. */
export type Lang = 'en' | 'sn' | 'nd';
export const LANGS: readonly Lang[] = ['en', 'sn', 'nd'];

export type ChannelId = 'whatsapp' | 'mock';

export interface Choice {
  id: string;
  title: string;
  description?: string;
}

export type OutboundMessage =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; body: string; buttons: Choice[]; footer?: string }
  | {
      kind: 'list';
      body: string;
      buttonLabel: string;
      sections: { title?: string; rows: Choice[] }[];
      footer?: string;
    }
  | {
      kind: 'media';
      mediaType: 'image' | 'audio' | 'video' | 'document';
      /** Storage key in the public bucket, or an absolute URL. */
      source: { key: string } | { url: string };
      caption?: string;
      filename?: string;
    }
  | { kind: 'template'; template: string; lang: Lang; params: string[]; buttons: Choice[]; preview: string };

export type InboundContent =
  | { kind: 'text'; text: string }
  | { kind: 'choice'; id: string; title?: string }
  | {
      kind: 'media';
      mediaType: 'image' | 'audio' | 'video';
      providerMediaId: string;
      mimeType: string;
      /** Voice note duration in seconds, when the provider sends it. */
      durationSec?: number;
    }
  | { kind: 'contact'; phone: string; name?: string }
  | { kind: 'location'; lat: number; lng: number }
  | { kind: 'unsupported' };

export interface InboundMessage {
  providerMessageId: string;
  channel: ChannelId;
  /** E.164 phone number. Kept in memory only; never logged. */
  from: string;
  receivedAt: Date;
  content: InboundContent;
}

export interface DeliveryEvent {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'undeliverable';
  error?: string;
  at: Date;
}

export const LIMITS = { maxButtons: 3, maxListRows: 10, maxButtonTitle: 20, maxRowTitle: 24, maxRowDescription: 72 };

/** Truncate to a channel limit without cutting a word in half where possible. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}
