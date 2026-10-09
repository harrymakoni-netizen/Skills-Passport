import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Logger } from '@sp/adapters';
import type { Env } from '@sp/config';
import type { ServiceContext } from '@sp/db';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type Redis from 'ioredis';
import { createAppModule } from './app.module';
import { ErrorFilter } from './infra/filters';
import { CTX, ENV, REDIS } from './infra/tokens';

/** Builds the Nest application (used by main.ts and tests). */
export async function createApp(opts: { env: Env; ctx: ServiceContext; redis: Redis; log: Logger }) {
  const Module = createAppModule(
    [
      { provide: CTX, useValue: opts.ctx },
      { provide: ENV, useValue: opts.env },
      { provide: REDIS, useValue: opts.redis },
    ],
    { devTools: opts.env.DEV_TOOLS },
  );
  const app = await NestFactory.create<NestExpressApplication>(Module, { rawBody: true, logger: ['error', 'warn'] });
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Request ids + structured access log (no bodies, no query strings with tokens).
  app.use((req: { id?: string; headers: Record<string, unknown>; method: string; path: string }, res: { setHeader: (k: string, v: string) => void; on: (e: string, f: () => void) => void; statusCode: number }, next: () => void) => {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/dev/mock/chat')) return;
      opts.log.info({ reqId: id, method: req.method, path: req.path.replace(/\/(c|confirmations)\/[^/]+/, '/$1/:token'), status: res.statusCode, ms: Date.now() - start }, 'request');
    });
    next();
  });
  app.useBodyParser('raw', { type: ['image/*', 'audio/*', 'video/*', 'application/octet-stream'], limit: '25mb' });
  app.useGlobalFilters(new ErrorFilter(opts.log));
  app.enableShutdownHooks();
  return app;
}
