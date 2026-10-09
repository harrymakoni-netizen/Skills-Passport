import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { currentTotp, generateTotpSecret, totpUri, verifyPassword, verifyTotp } from '@sp/adapters';
import type { Env } from '@sp/config';
import type { ServiceContext } from '@sp/db';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loadSessionUser, Public, SESSION_COOKIE, signChallenge, signSession, verifyToken } from '../infra/auth';
import { clientIp, CurrentUser, parse, rateLimit, type SessionUser } from '../infra/http';
import { CTX, ENV } from '../infra/tokens';

const loginBody = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });
const totpBody = z.object({ challenge: z.string().min(10), code: z.string().regex(/^\d{6}$/) });

/** Staff, verifiers and buyers: email + password, then an authenticator-app code (SPEC 3, PLAN Q19). */
@Controller('auth')
export class AuthController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext, @Inject(ENV) private readonly env: Env) {}

  private totpRequired(role: string) {
    return role === 'admin' || role === 'verifier' || role === 'agent';
  }

  private async setCookie(res: Response, userId: string) {
    const token = await signSession(this.env, userId);
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: this.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 * 1000 });
    await this.ctx.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: this.ctx.now() } });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await rateLimit(this.ctx, `login:${clientIp(req)}`, 10, 300);
    const { email, password } = parse(loginBody, body);
    const user = await this.ctx.prisma.user.findUnique({ where: { emailHash: this.ctx.adapters.crypto.lookupHash(email) } });
    const ok = user && user.active && (await verifyPassword(user.passwordHash, password));
    if (!ok || !user) throw new UnauthorizedException('Email or password is not right');
    if (user.totpSecretEnc && user.totpEnabledAt) return { next: 'totp', challenge: await signChallenge(this.env, user.id) };
    if (this.totpRequired(user.role)) {
      const secret = generateTotpSecret();
      await this.ctx.prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: this.ctx.adapters.crypto.encrypt(secret), totpEnabledAt: null } });
      return { next: 'enrol', challenge: await signChallenge(this.env, user.id), secret, uri: totpUri(email, secret) };
    }
    await this.setCookie(res, user.id);
    return { next: 'done', user: await loadSessionUser(this.ctx, user.id) };
  }

  @Public()
  @Post('totp')
  @HttpCode(200)
  async totp(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await rateLimit(this.ctx, `totp:${clientIp(req)}`, 10, 300);
    const { challenge, code } = parse(totpBody, body);
    const userId = await verifyToken(this.env, challenge, 'mfa').catch(() => null);
    if (!userId) throw new UnauthorizedException('Sign-in expired. Start again.');
    const user = await this.ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEnc) throw new UnauthorizedException('Authenticator not set up');
    if (!verifyTotp(this.ctx.adapters.crypto.decrypt(user.totpSecretEnc), code)) throw new UnauthorizedException('That code is not right. Check the time on your phone and try again.');
    if (!user.totpEnabledAt) await this.ctx.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: this.ctx.now() } });
    await this.setCookie(res, user.id);
    await this.ctx.prisma.auditLog.create({ data: { actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, at: this.ctx.now() } });
    return { next: 'done', user: await loadSessionUser(this.ctx, user.id) };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  /** Development only: the current TOTP code for a seeded demo account, so demos don't need a phone. */
  @Public()
  @Get('dev-code')
  async devCode(@Query('challenge') challenge: string) {
    if (!this.env.DEV_TOOLS) throw new NotFoundException();
    const userId = await verifyToken(this.env, challenge ?? '', 'mfa').catch(() => null);
    if (!userId) throw new ForbiddenException();
    const user = await this.ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEnc) throw new NotFoundException();
    return { code: currentTotp(this.ctx.adapters.crypto.decrypt(user.totpSecretEnc)) };
  }
}
