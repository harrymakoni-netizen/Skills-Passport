import type { Adapters, Logger } from '@sp/adapters';
import { DEFAULT_CONFIG, parseConfig, type RulesConfig } from '@sp/core';
import type { PrismaClient } from '@prisma/client';
import type { KeyValue } from './kv';
import type { TaskQueue } from './tasks';

/** Everything an application service needs. Built once per process (api, worker, seed, tests). */
export interface ServiceContext {
  prisma: PrismaClient;
  adapters: Adapters;
  queue: TaskQueue;
  kv: KeyValue;
  log: Logger;
  now(): Date;
  random(): number;
  publicBaseUrl: string;
  devTools: boolean;
  config(): Promise<{ version: number; params: RulesConfig }>;
}

export function configLoader(prisma: PrismaClient, now: () => Date, ttlMs = 15_000) {
  let cached: { at: number; value: { version: number; params: RulesConfig } } | null = null;
  const load = async () => {
    if (cached && Date.now() - cached.at < ttlMs) return cached.value;
    const row = await prisma.config.findFirst({ where: { activeFrom: { lte: now() } }, orderBy: { version: 'desc' } });
    const value = row ? { version: row.version, params: parseConfig(row.params) } : { version: 0, params: DEFAULT_CONFIG };
    cached = { at: Date.now(), value };
    return value;
  };
  load.invalidate = () => {
    cached = null;
  };
  return load;
}
