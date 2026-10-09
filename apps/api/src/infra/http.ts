import { BadRequestException, HttpException, HttpStatus, type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { ZodType } from 'zod';
import type { ServiceContext } from '@sp/db';

/** Validates input with zod; 400 with readable messages on failure (global validation). */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new BadRequestException({ message: 'Invalid input', issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  return r.data;
}

export interface SessionUser {
  id: string;
  role: 'admin' | 'verifier' | 'agent' | 'buyer';
  name: string;
  verifierId?: string;
  agentId?: string;
  buyerId?: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
  if (!req.user) throw new HttpException('Not signed in', HttpStatus.UNAUTHORIZED);
  return req.user;
});

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

/** Fixed-window rate limit backed by Redis (scraping protection on directory and confirmation pages). */
export async function rateLimit(ctx: ServiceContext, key: string, limit: number, windowSec: number) {
  const n = await ctx.kv.incr(`rl:${key}`, windowSec);
  if (n > limit) throw new HttpException('Too many requests. Please wait a moment.', HttpStatus.TOO_MANY_REQUESTS);
}
