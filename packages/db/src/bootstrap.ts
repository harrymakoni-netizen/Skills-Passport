import type { Env } from '@sp/config';
import { createAdapters, createLogger, type Adapters, type Logger } from '@sp/adapters';
import type { InboundMessage } from '@sp/core';
import { Queue, type ConnectionOptions } from 'bullmq';
import type Redis from 'ioredis';
import { getPrisma } from './client';
import { purgeDeleted } from './services/artisans';
import { processJobAi } from './services/ai';
import { expireConfirmation, markUndeliverable, sendConfirmation, sendReminder } from './services/confirmations';
import { configLoader, type ServiceContext } from './services/context';
import { processInbound, recordInbound } from './services/inbound';
import { MemoryKV, RedisKV, type KeyValue } from './services/kv';
import { recalculateLevel } from './services/levels';
import { processMedia } from './services/media';
import { runOutbound } from './services/outbound';
import type { TaskHandlers, TaskName, TaskPayloads, TaskQueue } from './services/tasks';
import { workRequestFollowUp } from './services/workRequests';

/** Every task runs on one of these BullMQ queues (separate queues so slow AI work never delays chat replies). */
export const QUEUE_OF: Record<TaskName, string> = {
  'inbound.process': 'inbound',
  'delivery.status': 'inbound',
  'media.process': 'media',
  'ai.process': 'ai',
  'confirmation.send': 'notify',
  'confirmation.remind': 'notify',
  'confirmation.expire': 'notify',
  'outbound.send': 'notify',
  'levels.recalculate': 'notify',
  'workrequest.followup': 'notify',
  'maintenance.purge': 'maintenance',
};
export const QUEUE_NAMES = [...new Set(Object.values(QUEUE_OF))];

/** BullMQ-backed TaskQueue with retries + exponential backoff; failed jobs are kept as a dead-letter list. */
export class BullTaskQueue implements TaskQueue {
  private readonly queues = new Map<string, Queue>();
  constructor(private readonly connection: ConnectionOptions) {}
  queue(name: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: false },
      });
      this.queues.set(name, q);
    }
    return q;
  }
  async enqueue<K extends TaskName>(name: K, data: TaskPayloads[K], opts?: { delayMs?: number; jobId?: string }) {
    await this.queue(QUEUE_OF[name]).add(name, data, { ...(opts?.delayMs ? { delay: opts.delayMs } : {}), ...(opts?.jobId ? { jobId: opts.jobId.replace(/:/g, '-') } : {}) });
  }
  async cancel(jobId: string) {
    const id = jobId.replace(/:/g, '-');
    for (const name of QUEUE_NAMES) {
      const job = await this.queue(name).getJob(id);
      if (job) await job.remove().catch(() => undefined);
    }
  }
  async close() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

export function createServiceContext(opts: {
  env: Env;
  redis: Redis | null;
  queue: TaskQueue;
  kv?: KeyValue;
  adapters?: Adapters;
  log?: Logger;
  now?: () => Date;
  random?: () => number;
}): ServiceContext {
  const now = opts.now ?? (() => new Date());
  const prisma = getPrisma();
  return {
    prisma,
    adapters: opts.adapters ?? createAdapters(opts.env, opts.redis),
    queue: opts.queue,
    kv: opts.kv ?? (opts.redis ? new RedisKV(opts.redis) : new MemoryKV(() => now().getTime())),
    log: opts.log ?? createLogger({ name: 'services', level: opts.env.LOG_LEVEL }),
    now,
    random: opts.random ?? Math.random,
    publicBaseUrl: opts.env.PUBLIC_BASE_URL,
    devTools: opts.env.DEV_TOOLS,
    config: configLoader(prisma, now),
  };
}

function reviveInbound(raw: string): InboundMessage {
  const m = JSON.parse(raw) as InboundMessage & { receivedAt: string };
  return { ...m, receivedAt: new Date(m.receivedAt) };
}

/** Task name → handler. Used by the BullMQ workers and by InlineQueue in tests and seeding. */
export function createTaskHandlers(ctx: ServiceContext): TaskHandlers {
  return {
    'inbound.process': async (d) => processInbound(ctx, reviveInbound(d.raw)),
    'delivery.status': async (d) => {
      const msg = await ctx.prisma.outboundMessage.findUnique({ where: { providerMessageId: d.providerMessageId } });
      if (!msg) return;
      const status = (['sent', 'delivered', 'read', 'failed', 'undeliverable'] as const).find((s) => s === d.status) ?? 'failed';
      await ctx.prisma.outboundMessage.update({ where: { id: msg.id }, data: { status, error: d.error ?? null } });
      if (msg.relatedEntity === 'confirmation' && msg.relatedId) {
        if (status === 'undeliverable') await markUndeliverable(ctx, msg.relatedId);
        else if (status === 'delivered' || status === 'read') await ctx.prisma.confirmation.update({ where: { id: msg.relatedId }, data: { deliveryStatus: status } }).catch(() => undefined);
      }
      if (status === 'failed' || status === 'undeliverable') ctx.log.warn({ purpose: msg.purpose, status }, 'whatsapp delivery failure');
    },
    'media.process': async (d) => processMedia(ctx, d.mediaId),
    'ai.process': async (d) => processJobAi(ctx, d.jobId, d.attempt ?? 0),
    'confirmation.send': async (d) => sendConfirmation(ctx, d.jobId),
    'confirmation.remind': async (d) => void (await sendReminder(ctx, d.confirmationId)),
    'confirmation.expire': async (d) => expireConfirmation(ctx, d.confirmationId),
    'outbound.send': async (d) => runOutbound(ctx, d),
    'levels.recalculate': async (d) => void (await recalculateLevel(ctx, d.artisanId, d.reason, { notify: d.notify })),
    'workrequest.followup': async (d) => workRequestFollowUp(ctx, d.workRequestId),
    'maintenance.purge': async () => void (await purgeDeleted(ctx)),
  };
}

/** Webhook entry point shared by the real WhatsApp webhook and the simulator: dedupe, then queue. */
export async function acceptInbound(ctx: ServiceContext, messages: InboundMessage[]) {
  let accepted = 0;
  for (const m of messages) {
    if (!(await recordInbound(ctx, m))) continue;
    await ctx.queue.enqueue('inbound.process', { providerMessageId: m.providerMessageId, channel: m.channel, raw: JSON.stringify(m) });
    accepted++;
  }
  return accepted;
}
