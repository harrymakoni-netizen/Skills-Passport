import { randomUUID } from 'node:crypto';
import type { DeliveryEvent, InboundMessage, OutboundMessage } from '@sp/core';
import type Redis from 'ioredis';
import type { ObjectStorage } from '../storage';
import { WHATSAPP_CAPABILITIES, type MessagingChannel, type RawWebhook } from './types';

/** One entry in a simulated phone's chat. */
export interface MockChatEntry {
  id: string;
  direction: 'in' | 'out';
  at: string;
  /** Outbound: the neutral message as WhatsApp would render it. Inbound: what the user sent. */
  message?: OutboundMessage;
  inbound?: InboundMessage['content'];
  /** Resolved media URL for display in the simulator. */
  mediaUrl?: string;
  status?: 'sent' | 'delivered' | 'read' | 'undeliverable';
}

export interface MockStore {
  append(phone: string, entry: MockChatEntry): Promise<void>;
  list(phone: string, since?: number): Promise<MockChatEntry[]>;
  clear(phone?: string): Promise<void>;
  /** Phones that cannot receive WhatsApp (simulates "client not on WhatsApp"). */
  isUnreachable(phone: string): Promise<boolean>;
  setUnreachable(phone: string, unreachable: boolean): Promise<void>;
}

export class MemoryMockStore implements MockStore {
  private readonly chats = new Map<string, MockChatEntry[]>();
  private readonly unreachable = new Set<string>();
  async append(phone: string, entry: MockChatEntry) {
    const list = this.chats.get(phone) ?? [];
    list.push(entry);
    this.chats.set(phone, list);
  }
  async list(phone: string, since = 0) {
    return (this.chats.get(phone) ?? []).slice(since);
  }
  async clear(phone?: string) {
    if (phone) this.chats.delete(phone);
    else this.chats.clear();
  }
  async isUnreachable(phone: string) {
    return this.unreachable.has(phone);
  }
  async setUnreachable(phone: string, v: boolean) {
    if (v) this.unreachable.add(phone);
    else this.unreachable.delete(phone);
  }
}

/** Redis-backed store so the API, worker and web simulator share one view of every simulated phone. */
export class RedisMockStore implements MockStore {
  constructor(private readonly redis: Redis) {}
  async append(phone: string, entry: MockChatEntry) {
    await this.redis.multi().rpush(`mock:chat:${phone}`, JSON.stringify(entry)).expire(`mock:chat:${phone}`, 7 * 86400).sadd('mock:phones', phone).exec();
    await this.redis.publish('mock:chat', phone);
  }
  async list(phone: string, since = 0) {
    const raw = await this.redis.lrange(`mock:chat:${phone}`, since, -1);
    return raw.map((r) => JSON.parse(r) as MockChatEntry);
  }
  async clear(phone?: string) {
    const phones = phone ? [phone] : await this.redis.smembers('mock:phones');
    if (phones.length) await this.redis.del(...phones.map((p) => `mock:chat:${p}`));
    if (!phone) await this.redis.del('mock:phones', 'mock:unreachable');
  }
  async isUnreachable(phone: string) {
    return (await this.redis.sismember('mock:unreachable', phone)) === 1;
  }
  async setUnreachable(phone: string, v: boolean) {
    if (v) await this.redis.sadd('mock:unreachable', phone);
    else await this.redis.srem('mock:unreachable', phone);
  }
}

export class UndeliverableError extends Error {
  constructor(public readonly to: string) {
    super('Recipient is not reachable on WhatsApp');
    this.name = 'UndeliverableError';
  }
}

/**
 * Offline WhatsApp stand-in. Outbound messages are recorded per phone for the /dev/chat simulator; inbound
 * messages from the simulator are fed through the same webhook pipeline as real WhatsApp (see apps/api).
 * Media "uploaded" by the simulator lives in private storage under mock-media/{id}.
 */
export class MockChannel implements MessagingChannel {
  readonly id = 'mock' as const;
  readonly capabilities = WHATSAPP_CAPABILITIES;
  constructor(
    private readonly store: MockStore,
    private readonly storage: ObjectStorage,
  ) {}

  async send(to: string, message: OutboundMessage, opts?: { mediaUrl?: string }) {
    if (await this.store.isUnreachable(to)) throw new UndeliverableError(to);
    const id = `mock-out-${randomUUID()}`;
    await this.store.append(to, {
      id,
      direction: 'out',
      at: new Date().toISOString(),
      message,
      ...(opts?.mediaUrl ? { mediaUrl: opts.mediaUrl } : {}),
      status: 'delivered',
    });
    return { providerMessageId: id };
  }

  async downloadMedia(providerMediaId: string) {
    const data = await this.storage.get('private', `mock-media/${providerMediaId}`);
    const meta = await this.storage.get('private', `mock-media/${providerMediaId}.type`).catch(() => Buffer.from('application/octet-stream'));
    return { data, mimeType: meta.toString('utf8') };
  }

  /** Stores simulator media so downloadMedia can serve it. Returns the provider media id. */
  async uploadSimulatorMedia(data: Buffer, mimeType: string): Promise<string> {
    const id = `mock-media-${randomUUID()}`;
    await this.storage.put('private', `mock-media/${id}`, data, { contentType: mimeType });
    await this.storage.put('private', `mock-media/${id}.type`, Buffer.from(mimeType));
    return id;
  }

  verifySignature(): boolean {
    return true;
  }

  /** The simulator posts neutral inbound messages as JSON. */
  parseWebhook(raw: RawWebhook): { messages: InboundMessage[]; deliveries: DeliveryEvent[] } {
    const body = JSON.parse(raw.body.toString('utf8')) as { messages?: (Omit<InboundMessage, 'receivedAt'> & { receivedAt?: string })[] };
    return {
      messages: (body.messages ?? []).map((m) => ({ ...m, channel: 'mock', receivedAt: m.receivedAt ? new Date(m.receivedAt) : new Date() })),
      deliveries: [],
    };
  }
}
