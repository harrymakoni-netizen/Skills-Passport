import pino, { type Logger } from 'pino';

/**
 * Structured logger with a redaction list (CLAUDE.md). Message bodies are never logged at production levels;
 * callers log ids and hashes only.
 */
export const REDACT_PATHS = [
  'phone',
  '*.phone',
  'to',
  '*.to',
  'from',
  '*.from',
  '*.name',
  'fullName',
  '*.fullName',
  'clientName',
  '*.clientName',
  'clientPhone',
  '*.clientPhone',
  'token',
  '*.token',
  'password',
  '*.password',
  'email',
  '*.email',
  'text',
  '*.text',
  'body',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

export function createLogger(opts: { name: string; level?: string; pretty?: boolean }): Logger {
  return pino({
    name: opts.name,
    level: opts.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(opts.pretty ? { transport: { target: 'pino/file', options: { destination: 1 } } } : {}),
  });
}

export type { Logger };
