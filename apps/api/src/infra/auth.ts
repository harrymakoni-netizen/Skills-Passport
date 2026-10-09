import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Env } from '@sp/config';
import type { ServiceContext } from '@sp/db';
import type { Request } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { SessionUser } from './http';
import { CTX, ENV } from './tokens';

export const SESSION_COOKIE = 'sp_session';
export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';
export const Roles = (...roles: SessionUser['role'][]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);

const key = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

export async function signSession(env: Env, userId: string, ttlSec = 12 * 3600) {
  return new SignJWT({ typ: 'session' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(key(env));
}

/** Short-lived token between the password step and the TOTP step. */
export async function signChallenge(env: Env, userId: string) {
  return new SignJWT({ typ: 'mfa' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('5m').sign(key(env));
}

export async function verifyToken(env: Env, token: string, typ: 'session' | 'mfa') {
  const { payload } = await jwtVerify(token, key(env), { algorithms: ['HS256'] });
  if (payload.typ !== typ || !payload.sub) throw new Error('Wrong token type');
  return payload.sub;
}

export async function loadSessionUser(ctx: ServiceContext, userId: string): Promise<SessionUser | null> {
  const u = await ctx.prisma.user.findUnique({ where: { id: userId }, include: { verifier: true, agent: true, buyer: true } });
  if (!u || !u.active) return null;
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    ...(u.verifier ? { verifierId: u.verifier.id } : {}),
    ...(u.agent ? { agentId: u.agent.id } : {}),
    ...(u.buyer ? { buyerId: u.buyer.id } : {}),
  };
}

/**
 * Global guard: every route needs a valid session unless marked @Public(); @Roles() restricts by role.
 * Mutating requests must carry the `x-sp-csrf` header, which cross-site forms cannot set (CSRF protection on top of
 * SameSite=Strict cookies).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CTX) private readonly ctx: ServiceContext,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser; cookies?: Record<string, string> }>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      try {
        const id = await verifyToken(this.env, token, 'session');
        req.user = (await loadSessionUser(this.ctx, id)) ?? undefined;
      } catch {
        req.user = undefined;
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new HttpException('Please sign in', HttpStatus.UNAUTHORIZED);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-sp-csrf'] !== '1') {
      throw new HttpException('Missing CSRF header', HttpStatus.FORBIDDEN);
    }
    const roles = this.reflector.getAllAndOverride<SessionUser['role'][] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(req.user.role)) throw new HttpException('You do not have access to this', HttpStatus.FORBIDDEN);
    return true;
  }
}
