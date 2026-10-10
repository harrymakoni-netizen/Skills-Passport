import { isFictionalTestPhone, type DeliveryEvent, type InboundMessage, type OutboundMessage } from '@sp/core';
import type { MockChannel } from './mock';
import { WHATSAPP_CAPABILITIES, type MessagingChannel, type RawWebhook } from './types';

/**
 * MESSAGING_DRIVER=hybrid: real WhatsApp for real people, the simulator for the fictional demo phones.
 * Messages to numbers in the reserved test range (+26377000xxxx) go to the mock channel (and appear in /dev/chat);
 * every other number goes to the WhatsApp Cloud API. Webhooks are always WhatsApp's.
 */
export class HybridChannel implements MessagingChannel {
  readonly id = 'whatsapp' as const;
  readonly capabilities = WHATSAPP_CAPABILITIES;
  constructor(
    private readonly whatsapp: MessagingChannel,
    private readonly mock: MockChannel,
  ) {}

  send(to: string, message: OutboundMessage, opts?: { mediaUrl?: string }) {
    return (isFictionalTestPhone(to) ? this.mock : this.whatsapp).send(to, message, opts);
  }

  downloadMedia(providerMediaId: string) {
    return (providerMediaId.startsWith('mock-media-') ? this.mock : this.whatsapp).downloadMedia(providerMediaId);
  }

  verifySignature(raw: RawWebhook): boolean {
    return this.whatsapp.verifySignature(raw);
  }

  parseWebhook(raw: RawWebhook): { messages: InboundMessage[]; deliveries: DeliveryEvent[] } {
    return this.whatsapp.parseWebhook(raw);
  }
}
