import type { IncomingMessage, ServerResponse } from 'node:http';
import { createLogger } from '@sp/adapters';
import { loadEnv } from '@sp/config';
import { createServerlessRuntime } from '@sp/db';
import { createApp } from './app';

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface ServerlessApi {
  /** The Nest (Express) request handler; paths are the API's own (no /api prefix). */
  handle: NodeHandler;
  /** Runs due background tasks. One drainer at a time keeps each conversation's messages in order. */
  drain(budgetMs?: number): Promise<number>;
  /** Enqueues the daily maintenance tasks (called by the scheduled-task endpoint). */
  daily(): Promise<void>;
  cronSecret: string | undefined;
}

let instance: Promise<ServerlessApi> | undefined;

async function build(): Promise<ServerlessApi> {
  const env = loadEnv();
  const log = createLogger({ name: 'api', level: env.LOG_LEVEL });
  const { ctx, queue } = createServerlessRuntime(env, log);
  const app = await createApp({ env, ctx, redis: null, log });
  await app.init();
  const handle = app.getHttpAdapter().getInstance() as NodeHandler;
  log.info({ channel: ctx.adapters.channel.id, devTools: env.DEV_TOOLS, runtime: env.RUNTIME }, 'serverless api ready');

  return {
    handle,
    async drain(budgetMs = 45_000) {
      if (!(await queue.hasDue())) return 0;
      const release = await ctx.kv.lock('queue:drain', budgetMs + 15_000);
      if (!release) return 0;
      try {
        return await queue.drain(budgetMs);
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : String(err) }, 'task drain failed');
        return 0;
      } finally {
        await release();
      }
    },
    async daily() {
      const day = new Date().toISOString().slice(0, 10);
      await queue.enqueue('maintenance.purge', {}, { jobId: `purge:${day}` });
    },
    cronSecret: env.CRON_SECRET,
  };
}

/** One Nest application per serverless instance, created on first use and reused across requests. */
export function getServerlessApi(): Promise<ServerlessApi> {
  instance ??= build().catch((err: unknown) => {
    instance = undefined;
    throw err;
  });
  return instance;
}
