import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ControllableClock, createAdapters, generateKey, MemoryMockStore, type MockChatEntry } from '@sp/adapters';
import { envSchema } from '@sp/config';
import { DEFAULT_CONFIG, seededRandom, type InboundContent, type OutboundMessage } from '@sp/core';
import type { Prisma } from '@prisma/client';
import { createServiceContext, createTaskHandlers, acceptInbound } from '../src/bootstrap';
import { getPrisma } from '../src/client';
import { AREAS, TRADES } from '../src/seed-data';
import { InlineQueue } from '../src/services/tasks';
import { MemoryKV } from '../src/services/kv';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sp:sp@localhost:5432/skills_passport_test';

export async function resetDb() {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  for (const tr of TRADES) {
    const trade = await prisma.trade.create({ data: { code: tr.code, nameEn: tr.en, nameSn: tr.sn, nameNd: tr.nd } });
    for (const [i, u] of tr.units.entries()) {
      await prisma.competencyUnit.create({ data: { code: u.code, tradeId: trade.id, title: { en: u.title, sn: u.title, nd: u.title }, description: u.description, evidenceGuidance: u.evidence, sortOrder: i } });
    }
    for (const [i, jt] of tr.jobTypes.entries()) {
      const units = await prisma.competencyUnit.findMany({ where: { code: { in: jt.units } } });
      await prisma.jobType.create({ data: { key: jt.key, tradeId: trade.id, name: { en: jt.name, sn: jt.name, nd: jt.name }, needsBeforePhoto: jt.needsBefore, sortOrder: i, units: { create: units.map((u) => ({ unitId: u.id })) } } });
    }
  }
  for (const a of AREAS) await prisma.area.create({ data: a });
  await prisma.config.create({ data: { version: 1, params: DEFAULT_CONFIG as unknown as Prisma.InputJsonValue, activeFrom: new Date('2020-01-01') } });
}

/** A full application stack in one process: real Postgres, in-memory queue/KV, mock WhatsApp, local storage. */
export function createHarness(opts: { random?: () => number } = {}) {
  const clock = new ControllableClock(new Date('2026-10-09T08:00:00Z'));
  const env = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    PII_ENCRYPTION_KEY: generateKey(),
    PHONE_HASH_PEPPER: 'test-pepper-0123456789-0123456789-abc',
    JWT_SECRET: 'test-jwt-secret-0123456789-0123456789',
    STORAGE_DRIVER: 'fs',
    STORAGE_FS_ROOT: mkdtempSync(join(tmpdir(), 'sp-test-')),
    PUBLIC_BASE_URL: 'https://sp.test',
    PUBLIC_MEDIA_BASE_URL: 'https://sp.test/media',
  });
  const adapters = createAdapters(env, null);
  const store = adapters.mock!.store as MemoryMockStore;
  const queue = new InlineQueue(() => clock.now());
  const ctx = createServiceContext({ env, redis: null, queue, adapters, kv: new MemoryKV(() => clock.now().getTime()), now: () => clock.now(), random: opts.random ?? seededRandom(1) });
  queue.setHandlers(createTaskHandlers(ctx));
  let n = 0;

  async function send(from: string, content: InboundContent | string): Promise<OutboundMessage[]> {
    const before = (await store.list(from)).length;
    const c: InboundContent = typeof content === 'string' ? { kind: 'text', text: content } : content;
    await acceptInbound(ctx, [{ providerMessageId: `t-${++n}`, channel: 'mock', from, receivedAt: clock.now(), content: c }]);
    await queue.drain();
    return (await store.list(from, before)).filter((e: MockChatEntry) => e.direction === 'out').map((e) => e.message!);
  }
  const tap = (from: string, id: string) => send(from, { kind: 'choice', id });
  async function media(from: string, file: string, mediaType: 'image' | 'audio') {
    const { readFileSync } = await import('node:fs');
    const data = readFileSync(join(import.meta.dirname, '../../../fixtures', file));
    const id = await adapters.mock!.channel.uploadSimulatorMedia(data, mediaType === 'image' ? 'image/jpeg' : 'audio/wav');
    return send(from, { kind: 'media', mediaType, providerMediaId: id, mimeType: mediaType === 'image' ? 'image/jpeg' : 'audio/wav', ...(mediaType === 'audio' ? { durationSec: 14 } : {}) });
  }
  const outbox = async (phone: string) => (await store.list(phone)).filter((e) => e.direction === 'out').map((e) => e.message!);
  return { ctx, clock, queue, store, send, tap, media, outbox, prisma: ctx.prisma };
}

export const body = (m: OutboundMessage | undefined) =>
  !m ? '' : m.kind === 'text' ? m.text : m.kind === 'buttons' || m.kind === 'list' ? m.body : m.kind === 'template' ? m.preview : (m.caption ?? '');
export const ids = (m: OutboundMessage | undefined) =>
  !m ? [] : m.kind === 'buttons' || m.kind === 'template' ? m.buttons.map((b) => b.id) : m.kind === 'list' ? m.sections.flatMap((s) => s.rows.map((r) => r.id)) : [];
