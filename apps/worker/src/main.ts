import { createServer } from 'node:http';
import { createLogger } from '@sp/adapters';
import { loadEnv } from '@sp/config';
import { BullTaskQueue, createServiceContext, createTaskHandlers, QUEUE_NAMES, type TaskHandlers, type TaskName } from '@sp/db';
import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

const env = loadEnv();
const log = createLogger({ name: 'worker', level: env.LOG_LEVEL });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new BullTaskQueue({ url: env.REDIS_URL, maxRetriesPerRequest: null } as never);
const ctx = createServiceContext({ env, redis, queue, log });
const handlers = createTaskHandlers(ctx);

/** Concurrency per queue: chat replies stay fast while media and AI work runs in parallel. */
const CONCURRENCY: Record<string, number> = { inbound: 8, media: 4, ai: 2, notify: 8, maintenance: 1 };

const workers = QUEUE_NAMES.map(
  (name) =>
    new Worker(
      name,
      async (job: Job) => {
        const handler = handlers[job.name as TaskName] as TaskHandlers[TaskName] | undefined;
        if (!handler) throw new Error(`No handler for ${job.name}`);
        const started = Date.now();
        await (handler as (d: unknown) => Promise<void>)(job.data);
        log.debug({ task: job.name, ms: Date.now() - started }, 'task done');
      },
      { connection: redis.duplicate(), concurrency: CONCURRENCY[name] ?? 4 },
    ),
);

for (const w of workers) {
  w.on('failed', (job, err) => {
    const final = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    const level = final && (job?.name === 'media.process' || job?.name === 'outbound.send' || job?.name === 'confirmation.send') ? 'error' : 'warn';
    // Alert hook: media pipeline and WhatsApp delivery failures are logged at error level for alerting (SPEC 9).
    log[level]({ queue: w.name, task: job?.name, attempts: job?.attemptsMade, final, err: err.message }, final ? 'task moved to dead-letter (failed set)' : 'task failed, will retry');
  });
}

// Daily maintenance: purge personal data of accounts deleted more than 30 days ago.
await queue.queue('maintenance').upsertJobScheduler('daily-purge', { pattern: '17 1 * * *', tz: 'Africa/Harare' }, { name: 'maintenance.purge', data: {} });

// Health + queue depth metrics.
const port = Number(process.env.WORKER_PORT ?? 4100);
const server = createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/metrics') {
    const depths: Record<string, unknown> = {};
    for (const name of QUEUE_NAMES) depths[name] = await queue.queue(name).getJobCounts('waiting', 'active', 'delayed', 'failed');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', redis: redis.status, queues: depths }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(port, () => log.info({ port, queues: QUEUE_NAMES }, 'worker ready'));

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down: finishing active tasks');
  server.close();
  await Promise.all(workers.map((w) => w.close()));
  await queue.close();
  await ctx.prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
