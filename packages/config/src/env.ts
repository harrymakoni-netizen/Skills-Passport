import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** Every environment variable the platform reads. Documented in `.env.example`. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  API_PORT: z.coerce.number().int().default(4000),
  WEB_PORT: z.coerce.number().int().default(3000),
  /** Public base URL of the web app; used in passport links, QR codes and client rating links. */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  /** Internal URL the web app uses to call the API. */
  API_INTERNAL_URL: z.string().url().default('http://localhost:4000'),

  PII_ENCRYPTION_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/=]{43,44}$/, 'PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded'),
  PHONE_HASH_PEPPER: z.string().min(32),
  JWT_SECRET: z.string().min(32),

  STORAGE_DRIVER: z.enum(['s3', 'fs']).default('s3'),
  STORAGE_FS_ROOT: z.string().default('.data/storage'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_PRIVATE: z.string().default('sp-private'),
  S3_BUCKET_PUBLIC: z.string().default('sp-public'),
  S3_FORCE_PATH_STYLE: bool.default('true'),
  /** Base URL that serves the public bucket (CDN in production). */
  PUBLIC_MEDIA_BASE_URL: z.string().url().default('http://localhost:4000/media'),

  MESSAGING_DRIVER: z.enum(['mock', 'whatsapp']).default('mock'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_GRAPH_URL: z.string().url().default('https://graph.facebook.com/v21.0'),

  STT_DRIVER: z.enum(['mock', 'whisper']).default('mock'),
  STT_BASE_URL: z.string().url().optional(),
  STT_API_KEY: z.string().optional(),
  STT_MODEL: z.string().optional(),

  LLM_DRIVER: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),

  /** Enables /dev routes and the mock-channel endpoints. Always false in production. */
  DEV_TOOLS: bool.default('true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function findRootEnv(start: string): string | undefined {
  let dir = resolve(start);
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Loads and validates the environment once. Throws a readable error listing every invalid variable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  if (source === process.env) {
    const file = findRootEnv(process.cwd());
    if (file) loadDotenv({ path: file, quiet: true });
  }
  // Empty values in .env mean "not set".
  const clean = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = envSchema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    env.DEV_TOOLS = false;
    if (env.MESSAGING_DRIVER === 'mock') throw new Error('MESSAGING_DRIVER=mock is not allowed in production');
  }
  if (source === process.env) cached = env;
  return env;
}

/** For tests: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
