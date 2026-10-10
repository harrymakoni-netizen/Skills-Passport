import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
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

  /**
   * server: long-running api + worker processes with Redis and BullMQ (docker-compose, containers).
   * serverless: one Vercel deployment; the API runs inside the web app and queue, key-value and objects live in
   * PostgreSQL, so the only service it needs is a database.
   */
  RUNTIME: z.enum(['server', 'serverless']).default('server'),
  /**
   * Public demo build: fictional seed data, the WhatsApp simulator and demo sign-in help stay on in a production
   * build. Never set this on a deployment that holds real people's data.
   */
  PUBLIC_DEMO: bool.default('false'),
  /**
   * Password for the seeded demo staff and buyer accounts. When set, every build resets those accounts to it, so a
   * deployment that holds real people's data does not keep the public demo password.
   */
  STAFF_PASSWORD: z.string().min(12).optional(),
  /** Shared secret for the scheduled-task endpoint (Vercel Cron sends it as a bearer token). */
  CRON_SECRET: z.string().min(16).optional(),

  STORAGE_DRIVER: z.enum(['s3', 'fs', 'db']).default('s3'),
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

  /** mock = simulator only; whatsapp = Cloud API only; hybrid = Cloud API, except fictional +26377000xxxx phones (simulator). */
  MESSAGING_DRIVER: z.enum(['mock', 'whatsapp', 'hybrid']).default('mock'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  /** WhatsApp Business Account id; needed to list and submit message templates from the admin console. */
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
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
  let root = process.cwd();
  if (source === process.env) {
    const file = findRootEnv(process.cwd());
    if (file) {
      loadDotenv({ path: file, quiet: true });
      root = dirname(file);
    }
  }
  // Empty values in .env mean "not set".
  const clean: Record<string, string | undefined> = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  // On Vercel, default the public URLs to the project's production domain (links, QR codes, media).
  const vercelHost = clean.VERCEL_ENV === 'production' ? clean.VERCEL_PROJECT_PRODUCTION_URL : clean.VERCEL_URL;
  if (vercelHost) {
    clean.PUBLIC_BASE_URL ??= `https://${vercelHost}`;
    clean.PUBLIC_MEDIA_BASE_URL ??= `${clean.PUBLIC_BASE_URL}/media`;
  }
  const parsed = envSchema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  const env = parsed.data;
  // Relative storage paths are anchored at the repository root (where .env lives), so every process shares them.
  if (!isAbsolute(env.STORAGE_FS_ROOT)) env.STORAGE_FS_ROOT = join(root, env.STORAGE_FS_ROOT);
  if (env.NODE_ENV === 'production' && !env.PUBLIC_DEMO) {
    env.DEV_TOOLS = false;
    if (env.MESSAGING_DRIVER === 'mock') throw new Error('MESSAGING_DRIVER=mock is not allowed in production');
  }
  if (source === process.env) cached = env;
  return env;
}

/**
 * Directory holding the demo fixtures (photos, voice notes). FIXTURES_DIR wins; otherwise the nearest `fixtures/`
 * folder above the working directory, which also works inside a bundled serverless function.
 */
export function fixturesDir(): string {
  if (process.env.FIXTURES_DIR) return resolve(process.env.FIXTURES_DIR);
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'fixtures');
    if (existsSync(join(candidate, 'photos'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), 'fixtures');
}

/** For tests: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
