import { randomUUID } from 'node:crypto';
import { apiSignedUrls, safeKey, type AdapterOverrides, type Bucket, type Logger, type MockChatEntry, type MockStore, type ObjectStorage } from '@sp/adapters';
import type { Env } from '@sp/config';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { KeyValue } from './kv';
import type { TaskHandlers, TaskName, TaskPayloads, TaskQueue } from './tasks';

/*
 * Serverless runtime (RUNTIME=serverless). A Vercel deployment has no Redis and no long-running worker, so the
 * key-value store, the task queue, simulated chats and (with STORAGE_DRIVER=db) objects live in PostgreSQL.
 * Timestamps are compared in UTC on the database clock.
 */

const NOW = `timezone('UTC', now())`;

export class PgKV implements KeyValue {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string) {
    const rows = await this.prisma.$queryRawUnsafe<{ value: string }[]>(
      `SELECT value FROM kv_entries WHERE key = $1 AND (expires_at IS NULL OR expires_at > ${NOW})`,
      key,
    );
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string, ttlSec?: number) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO kv_entries (key, value, expires_at) VALUES ($1, $2, CASE WHEN $3::int IS NULL THEN NULL ELSE ${NOW} + make_interval(secs => $3::int) END)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      key,
      value,
      ttlSec ?? null,
    );
  }

  async del(key: string) {
    await this.prisma.kvEntry.deleteMany({ where: { key } });
  }

  async incr(key: string, ttlSec: number) {
    const rows = await this.prisma.$queryRawUnsafe<{ value: string }[]>(
      `INSERT INTO kv_entries (key, value, expires_at) VALUES ($1, '1', ${NOW} + make_interval(secs => $2::int))
       ON CONFLICT (key) DO UPDATE SET
         value = CASE WHEN kv_entries.expires_at IS NOT NULL AND kv_entries.expires_at <= ${NOW} THEN '1' ELSE (kv_entries.value::bigint + 1)::text END,
         expires_at = CASE WHEN kv_entries.expires_at IS NOT NULL AND kv_entries.expires_at <= ${NOW} THEN EXCLUDED.expires_at ELSE kv_entries.expires_at END
       RETURNING value`,
      key,
      ttlSec,
    );
    return Number(rows[0]!.value);
  }

  async lock(key: string, ttlMs: number) {
    const token = randomUUID();
    const rows = await this.prisma.$queryRawUnsafe<{ key: string }[]>(
      `INSERT INTO kv_entries (key, value, expires_at) VALUES ($1, $2, ${NOW} + make_interval(secs => $3::double precision / 1000))
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
       WHERE kv_entries.expires_at IS NOT NULL AND kv_entries.expires_at <= ${NOW}
       RETURNING key`,
      key,
      token,
      ttlMs,
    );
    if (rows.length === 0) return null;
    return async () => {
      await this.prisma.kvEntry.deleteMany({ where: { key, value: token } });
    };
  }
}

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = 2000;

/**
 * Database task queue. Tasks are claimed one at a time with FOR UPDATE SKIP LOCKED, retried with exponential
 * backoff (as the BullMQ queues are), and kept with `failed_at` set after the last attempt (the dead-letter set).
 */
export class PgTaskQueue implements TaskQueue {
  private handlers: Partial<TaskHandlers> = {};
  constructor(
    private readonly prisma: PrismaClient,
    private readonly log?: Logger,
  ) {}

  setHandlers(h: Partial<TaskHandlers>) {
    this.handlers = h;
  }

  async enqueue<K extends TaskName>(name: K, data: TaskPayloads[K], opts?: { delayMs?: number; jobId?: string }) {
    await this.prisma.queuedTask.createMany({
      data: [{ name, data: data as Prisma.InputJsonValue, dueAt: new Date(Date.now() + (opts?.delayMs ?? 0)), jobId: opts?.jobId ?? null }],
      skipDuplicates: true,
    });
  }

  async cancel(jobId: string) {
    await this.prisma.queuedTask.deleteMany({ where: { jobId } });
  }

  /** True when at least one task is due and not being worked on. */
  async hasDue() {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM queued_tasks WHERE failed_at IS NULL AND due_at <= ${NOW} AND (locked_until IS NULL OR locked_until < ${NOW}) LIMIT 1`,
    );
    return rows.length > 0;
  }

  /** Runs due tasks (and the tasks they enqueue) until none are due or the time budget is spent. */
  async drain(budgetMs = 45_000): Promise<number> {
    const stop = Date.now() + budgetMs;
    let ran = 0;
    while (Date.now() < stop) {
      const [task] = await this.prisma.$queryRawUnsafe<{ id: string; name: TaskName; data: unknown; attempts: number }[]>(
        `UPDATE queued_tasks SET locked_until = ${NOW} + interval '5 minutes', attempts = attempts + 1
         WHERE id = (
           SELECT id FROM queued_tasks
           WHERE failed_at IS NULL AND due_at <= ${NOW} AND (locked_until IS NULL OR locked_until < ${NOW})
           ORDER BY due_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING id, name, data, attempts`,
      );
      if (!task) break;
      ran++;
      const handler = this.handlers[task.name] as ((d: unknown) => Promise<void>) | undefined;
      try {
        if (!handler) throw new Error(`No handler for task ${task.name}`);
        await handler(task.data);
        await this.prisma.queuedTask.delete({ where: { id: task.id } });
      } catch (err) {
        const final = task.attempts >= MAX_ATTEMPTS;
        const message = err instanceof Error ? err.message : String(err);
        this.log?.[final ? 'error' : 'warn']({ task: task.name, attempts: task.attempts, final, err: message }, final ? 'task moved to dead-letter (failed_at set)' : 'task failed, will retry');
        await this.prisma.queuedTask.update({
          where: { id: task.id },
          data: final
            ? { failedAt: new Date(), lockedUntil: null, lastError: message.slice(0, 2000) }
            : { dueAt: new Date(Date.now() + BACKOFF_MS * 2 ** (task.attempts - 1)), lockedUntil: null, lastError: message.slice(0, 2000) },
        });
      }
    }
    return ran;
  }
}

/** Objects in PostgreSQL; private and signed URLs are served by the API's /media routes. */
export class DbStorage implements ObjectStorage {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly publicBase: string,
    private readonly sign: (path: string, expires: number) => string,
  ) {}
  private get urls() {
    return apiSignedUrls(this.publicBase, this.sign);
  }
  async put(bucket: Bucket, key: string, data: Buffer, opts?: { contentType?: string }) {
    const k = safeKey(key);
    const bytes = new Uint8Array(data);
    await this.prisma.storedObject.upsert({
      where: { bucket_key: { bucket, key: k } },
      create: { bucket, key: k, data: bytes, contentType: opts?.contentType ?? null },
      update: { data: bytes, contentType: opts?.contentType ?? null },
    });
  }
  async get(bucket: Bucket, key: string) {
    const row = await this.prisma.storedObject.findUnique({ where: { bucket_key: { bucket, key: safeKey(key) } }, select: { data: true } });
    if (!row) throw new Error(`Object not found: ${bucket}/${key}`);
    return Buffer.from(row.data);
  }
  async exists(bucket: Bucket, key: string) {
    return (await this.prisma.storedObject.count({ where: { bucket, key: safeKey(key) } })) > 0;
  }
  async delete(bucket: Bucket, key: string) {
    await this.prisma.storedObject.deleteMany({ where: { bucket, key: safeKey(key) } });
  }
  async signedGetUrl(bucket: Bucket, key: string, ttlSec: number) {
    return this.urls.get(bucket, key, ttlSec);
  }
  async signedPutUrl(bucket: Bucket, key: string, opts: { ttlSec: number }) {
    return this.urls.put(bucket, key, opts.ttlSec);
  }
  publicUrl(key: string) {
    return this.urls.public(key);
  }
}

/** Simulator chats in PostgreSQL (mock channel only). */
export class PgMockStore implements MockStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kv: KeyValue,
  ) {}
  async append(phone: string, entry: MockChatEntry) {
    await this.prisma.mockChatEntry.create({ data: { phone, entry: entry as unknown as Prisma.InputJsonValue } });
  }
  async list(phone: string, since = 0) {
    const rows = await this.prisma.mockChatEntry.findMany({ where: { phone }, orderBy: { id: 'asc' }, skip: since, select: { entry: true } });
    return rows.map((r) => r.entry as unknown as MockChatEntry);
  }
  async clear(phone?: string) {
    await this.prisma.mockChatEntry.deleteMany(phone ? { where: { phone } } : undefined);
    if (!phone) await this.prisma.kvEntry.deleteMany({ where: { key: { startsWith: 'mock:unreachable:' } } });
  }
  async isUnreachable(phone: string) {
    return (await this.kv.get(`mock:unreachable:${phone}`)) !== null;
  }
  async setUnreachable(phone: string, unreachable: boolean) {
    if (unreachable) await this.kv.set(`mock:unreachable:${phone}`, '1');
    else await this.kv.del(`mock:unreachable:${phone}`);
  }
}

/** Database-backed adapter implementations selected by STORAGE_DRIVER=db and RUNTIME=serverless. */
export function databaseAdapterOverrides(env: Env, prisma: PrismaClient): AdapterOverrides {
  return {
    ...(env.STORAGE_DRIVER === 'db' ? { storage: (sign: (path: string, expires: number) => string) => new DbStorage(prisma, env.PUBLIC_MEDIA_BASE_URL, sign) } : {}),
    ...(env.RUNTIME === 'serverless' ? { mockStore: new PgMockStore(prisma, new PgKV(prisma)) } : {}),
  };
}
