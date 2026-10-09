import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '../src/client';
import { DbStorage, PgKV, PgMockStore, PgTaskQueue } from '../src/services/serverless';
import { resetDb } from './harness';

const prisma = getPrisma();
const sign = (path: string, expires: number) => `sig-${path}-${expires}`;

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('PgKV', () => {
  const kv = new PgKV(prisma);

  it('sets, gets and deletes values', async () => {
    expect(await kv.get('a')).toBeNull();
    await kv.set('a', '1');
    expect(await kv.get('a')).toBe('1');
    await kv.set('a', '2', 60);
    expect(await kv.get('a')).toBe('2');
    await kv.del('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('hides expired values', async () => {
    await prisma.kvEntry.create({ data: { key: 'old', value: 'x', expiresAt: new Date(Date.now() - 1000) } });
    expect(await kv.get('old')).toBeNull();
  });

  it('counts within a window and restarts after it expires', async () => {
    expect(await kv.incr('n', 60)).toBe(1);
    expect(await kv.incr('n', 60)).toBe(2);
    expect(await kv.incr('n', 60)).toBe(3);
    await prisma.kvEntry.update({ where: { key: 'n' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await kv.incr('n', 60)).toBe(1);
  });

  it('gives a lock to one holder until it is released or expires', async () => {
    const release = await kv.lock('l', 10_000);
    expect(release).not.toBeNull();
    expect(await kv.lock('l', 10_000)).toBeNull();
    await release!();
    const again = await kv.lock('l', 10_000);
    expect(again).not.toBeNull();
    await prisma.kvEntry.update({ where: { key: 'l' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await kv.lock('l', 10_000)).not.toBeNull();
  });
});

describe('PgTaskQueue', () => {
  it('runs due tasks in order, including tasks they enqueue, and skips delayed ones', async () => {
    const queue = new PgTaskQueue(prisma);
    const ran: string[] = [];
    queue.setHandlers({
      'media.process': async (d) => {
        ran.push(`media:${d.mediaId}`);
        if (d.mediaId === 'm1') await queue.enqueue('ai.process', { jobId: 'j1' });
      },
      'ai.process': async (d) => void ran.push(`ai:${d.jobId}`),
      'confirmation.expire': async () => void ran.push('expire'),
    });
    await queue.enqueue('media.process', { mediaId: 'm1' });
    await queue.enqueue('media.process', { mediaId: 'm2' });
    await queue.enqueue('confirmation.expire', { confirmationId: 'c1' }, { delayMs: 60_000 });
    expect(await queue.drain(10_000)).toBe(3);
    expect(ran).toEqual(['media:m1', 'media:m2', 'ai:j1']);
    expect(await queue.hasDue()).toBe(false);
    expect(await prisma.queuedTask.count()).toBe(1);
  });

  it('de-duplicates by job id and cancels', async () => {
    const queue = new PgTaskQueue(prisma);
    await queue.enqueue('confirmation.remind', { confirmationId: 'c1', n: 1 }, { jobId: 'remind:c1' });
    await queue.enqueue('confirmation.remind', { confirmationId: 'c1', n: 1 }, { jobId: 'remind:c1' });
    expect(await prisma.queuedTask.count()).toBe(1);
    await queue.cancel('remind:c1');
    expect(await prisma.queuedTask.count()).toBe(0);
  });

  it('retries a failing task with backoff and keeps it as failed after the last attempt', async () => {
    const queue = new PgTaskQueue(prisma);
    queue.setHandlers({ 'media.process': async () => Promise.reject(new Error('boom')) });
    await queue.enqueue('media.process', { mediaId: 'm1' });
    await queue.drain(10_000);
    let row = await prisma.queuedTask.findFirstOrThrow();
    expect(row.attempts).toBe(1);
    expect(row.dueAt.getTime()).toBeGreaterThan(Date.now());
    expect(row.failedAt).toBeNull();
    for (let i = 0; i < 4; i++) {
      await prisma.queuedTask.update({ where: { id: row.id }, data: { dueAt: new Date(Date.now() - 1000) } });
      await queue.drain(10_000);
    }
    row = await prisma.queuedTask.findFirstOrThrow();
    expect(row.attempts).toBe(5);
    expect(row.failedAt).not.toBeNull();
    expect(row.lastError).toBe('boom');
    expect(await queue.hasDue()).toBe(false);
  });
});

describe('DbStorage', () => {
  const storage = new DbStorage(prisma, 'https://passport.test/media', sign);

  it('stores, reads and deletes objects per bucket', async () => {
    await storage.put('private', 'jobs/a.jpg', Buffer.from('original'), { contentType: 'image/jpeg' });
    await storage.put('public', 'jobs/a.jpg', Buffer.from('copy'));
    expect((await storage.get('private', 'jobs/a.jpg')).toString()).toBe('original');
    expect((await storage.get('public', 'jobs/a.jpg')).toString()).toBe('copy');
    expect(await storage.exists('private', 'jobs/a.jpg')).toBe(true);
    await storage.delete('private', 'jobs/a.jpg');
    expect(await storage.exists('private', 'jobs/a.jpg')).toBe(false);
    await expect(storage.get('private', 'jobs/a.jpg')).rejects.toThrow();
  });

  it('rejects unsafe keys and builds signed API URLs', async () => {
    await expect(storage.put('public', '../x', Buffer.from('x'))).rejects.toThrow(/Unsafe/);
    expect(storage.publicUrl('jobs/a.jpg')).toBe('https://passport.test/media/jobs/a.jpg');
    expect(await storage.signedGetUrl('private', 'jobs/a.jpg', 60)).toMatch(/^https:\/\/passport\.test\/media\/signed\/private\/jobs\/a\.jpg\?e=\d+&s=sig-/);
  });
});

describe('PgMockStore', () => {
  it('keeps chats per phone and tracks unreachable phones', async () => {
    const store = new PgMockStore(prisma, new PgKV(prisma));
    const entry = (id: string) => ({ id, direction: 'out' as const, at: new Date().toISOString() });
    await store.append('+263770000101', entry('1'));
    await store.append('+263770000101', entry('2'));
    await store.append('+263770000102', entry('3'));
    expect((await store.list('+263770000101')).map((e) => e.id)).toEqual(['1', '2']);
    expect((await store.list('+263770000101', 1)).map((e) => e.id)).toEqual(['2']);
    await store.setUnreachable('+263770000102', true);
    expect(await store.isUnreachable('+263770000102')).toBe(true);
    await store.clear('+263770000101');
    expect(await store.list('+263770000101')).toEqual([]);
    await store.clear();
    expect(await store.list('+263770000102')).toEqual([]);
    expect(await store.isUnreachable('+263770000102')).toBe(false);
  });
});
