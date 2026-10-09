import { createLogger } from '@sp/adapters';
import { loadEnv } from '@sp/config';
import { BullTaskQueue, createServiceContext } from '@sp/db';
import Redis from 'ioredis';
import { createApp } from './app';

const env = loadEnv();
const log = createLogger({ name: 'api', level: env.LOG_LEVEL });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new BullTaskQueue({ url: env.REDIS_URL, maxRetriesPerRequest: null } as never);
const ctx = createServiceContext({ env, redis, queue, log });
const app = await createApp({ env, ctx, redis, log });
await app.listen(env.API_PORT);
log.info({ port: env.API_PORT, channel: ctx.adapters.channel.id, devTools: env.DEV_TOOLS }, 'api ready');
