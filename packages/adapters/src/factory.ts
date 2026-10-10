import { createHmac } from 'node:crypto';
import type { Env } from '@sp/config';
import type Redis from 'ioredis';
import { AnthropicLlmProvider, MockLlmProvider, MockSpeechToText, WhisperSpeechToText, type LlmProvider, type SpeechToText } from './ai';
import { createPiiCrypto, type PiiCrypto } from './crypto';
import { MemoryMockStore, MockChannel, RedisMockStore, type MockStore } from './messaging/mock';
import type { MessagingChannel } from './messaging/types';
import { HybridChannel } from './messaging/hybrid';
import { WhatsAppCloudChannel } from './messaging/whatsapp';
import { FsStorage, S3Storage, type ObjectStorage } from './storage';

export interface Adapters {
  storage: ObjectStorage;
  channel: MessagingChannel;
  /** Present when MESSAGING_DRIVER is mock or hybrid (the simulator). */
  mock: { channel: MockChannel; store: MockStore } | null;
  /** Present when MESSAGING_DRIVER is whatsapp or hybrid (template management in the admin console). */
  whatsapp: WhatsAppCloudChannel | null;
  stt: SpeechToText;
  llm: LlmProvider;
  crypto: PiiCrypto;
  signMedia: (path: string, expires: number) => string;
}

/** Implementations that live outside this package (database-backed ones in @sp/db). */
export interface AdapterOverrides {
  storage?: (signMedia: (path: string, expires: number) => string) => ObjectStorage;
  mockStore?: MockStore;
}

/** Selects real or mock implementations from environment variables. Mocks are the default. */
export function createAdapters(env: Env, redis: Redis | null, overrides: AdapterOverrides = {}): Adapters {
  const signMedia = (path: string, expires: number) => createHmac('sha256', env.JWT_SECRET).update(`${path}:${expires}`).digest('base64url');
  let storage: ObjectStorage;
  if (overrides.storage) storage = overrides.storage(signMedia);
  else if (env.STORAGE_DRIVER === 'fs') storage = new FsStorage(env.STORAGE_FS_ROOT, env.PUBLIC_MEDIA_BASE_URL, signMedia);
  else if (env.STORAGE_DRIVER === 's3') storage = new S3Storage(env);
  else throw new Error(`STORAGE_DRIVER=${env.STORAGE_DRIVER} needs a storage implementation from @sp/db`);

  let channel: MessagingChannel;
  let mock: Adapters['mock'] = null;
  let whatsapp: WhatsAppCloudChannel | null = null;
  if (env.MESSAGING_DRIVER === 'whatsapp' || env.MESSAGING_DRIVER === 'hybrid') {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_APP_SECRET) {
      throw new Error(`MESSAGING_DRIVER=${env.MESSAGING_DRIVER} needs WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN and WHATSAPP_APP_SECRET`);
    }
    whatsapp = new WhatsAppCloudChannel({
      graphUrl: env.WHATSAPP_GRAPH_URL,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      appSecret: env.WHATSAPP_APP_SECRET,
      ...(env.WHATSAPP_BUSINESS_ACCOUNT_ID ? { businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID } : {}),
      mediaUrl: (key) => storage.publicUrl(key),
    });
  }
  if (env.MESSAGING_DRIVER === 'mock' || env.MESSAGING_DRIVER === 'hybrid') {
    const store = overrides.mockStore ?? (redis ? new RedisMockStore(redis) : new MemoryMockStore());
    mock = { channel: new MockChannel(store, storage), store };
  }
  if (env.MESSAGING_DRIVER === 'hybrid') channel = new HybridChannel(whatsapp!, mock!.channel);
  else channel = whatsapp ?? mock!.channel;

  let stt: SpeechToText = new MockSpeechToText();
  if (env.STT_DRIVER === 'whisper') {
    if (!env.STT_BASE_URL || !env.STT_MODEL) throw new Error('STT_DRIVER=whisper needs STT_BASE_URL and STT_MODEL');
    stt = new WhisperSpeechToText({ baseUrl: env.STT_BASE_URL, model: env.STT_MODEL, ...(env.STT_API_KEY ? { apiKey: env.STT_API_KEY } : {}) });
  }

  let llm: LlmProvider = new MockLlmProvider();
  if (env.LLM_DRIVER === 'anthropic') {
    if (!env.LLM_MODEL) throw new Error('LLM_DRIVER=anthropic needs LLM_MODEL');
    llm = new AnthropicLlmProvider({ model: env.LLM_MODEL, ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}), ...(env.ANTHROPIC_BASE_URL ? { baseUrl: env.ANTHROPIC_BASE_URL } : {}) });
  }

  return {
    storage,
    channel,
    mock,
    whatsapp,
    stt,
    llm,
    crypto: createPiiCrypto({ key: env.PII_ENCRYPTION_KEY, pepper: env.PHONE_HASH_PEPPER }),
    signMedia,
  };
}
