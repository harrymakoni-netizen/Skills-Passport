import type { ChannelId, DeliveryEvent, InboundMessage, OutboundMessage } from '@sp/core';

export interface ChannelCapabilities {
  maxButtons: number;
  maxListRows: number;
  media: boolean;
  /** Business-initiated messages outside the 24-hour window must use approved templates. */
  templatesRequiredOutside24h: boolean;
  maxTextLength: number;
}

export interface RawWebhook {
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

/**
 * Channel-neutral messaging port. Flows only produce `OutboundMessage`s; each adapter renders them for its medium
 * (WhatsApp interactive messages now, numbered SMS menus / USSD pages later) and parses replies back.
 */
export interface MessagingChannel {
  readonly id: ChannelId;
  readonly capabilities: ChannelCapabilities;
  send(to: string, message: OutboundMessage, opts?: { mediaUrl?: string }): Promise<{ providerMessageId: string }>;
  downloadMedia(providerMediaId: string): Promise<{ data: Buffer; mimeType: string }>;
  verifySignature(raw: RawWebhook): boolean;
  parseWebhook(raw: RawWebhook): { messages: InboundMessage[]; deliveries: DeliveryEvent[] };
}

export const WHATSAPP_CAPABILITIES: ChannelCapabilities = {
  maxButtons: 3,
  maxListRows: 10,
  media: true,
  templatesRequiredOutside24h: true,
  maxTextLength: 4096,
};
