import { Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Put, Query, Req, Res } from '@nestjs/common';
import { safeEqual } from '@sp/adapters';
import type { ServiceContext } from '@sp/db';
import type { Request, Response } from 'express';
import { Public } from '../infra/auth';
import { CTX } from '../infra/tokens';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', wav: 'audio/wav', ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', '3gp': 'video/3gpp' };
const typeOf = (key: string) => TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/**
 * Serves the public bucket and HMAC-signed private URLs when objects are on local disk (STORAGE_DRIVER=fs).
 * With S3/MinIO, the public bucket is served by the bucket/CDN directly and these routes act as a fallback.
 */
@Public()
@Controller('media')
export class MediaController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext) {}

  private check(path: string, e: string, s: string) {
    const expires = Number(e);
    if (!expires || expires < Date.now() / 1000) throw new ForbiddenException('Link expired');
    if (!s || !safeEqual(this.ctx.adapters.signMedia(path, expires), s)) throw new ForbiddenException('Bad signature');
  }

  @Get('signed/:bucket/*key')
  async signed(@Param('bucket') bucket: string, @Param('key') key: string | string[], @Query('e') e: string, @Query('s') s: string, @Res() res: Response) {
    const k = Array.isArray(key) ? key.join('/') : key;
    if (bucket !== 'private' && bucket !== 'public') throw new NotFoundException();
    this.check(`${bucket}/${k}`, e, s);
    const data = await this.ctx.adapters.storage.get(bucket, k).catch(() => null);
    if (!data) throw new NotFoundException();
    res.set({ 'Content-Type': typeOf(k), 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }).send(data);
  }

  @Put('upload/:bucket/*key')
  async upload(@Param('bucket') bucket: string, @Param('key') key: string | string[], @Query('e') e: string, @Query('s') s: string, @Req() req: Request & { rawBody?: Buffer }) {
    const k = Array.isArray(key) ? key.join('/') : key;
    if (bucket !== 'private') throw new NotFoundException();
    this.check(`put:${bucket}/${k}`, e, s);
    const body = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);
    if (!body || body.length === 0) throw new ForbiddenException('Empty upload');
    if (body.length > 20 * 1024 * 1024) throw new ForbiddenException('File too large');
    await this.ctx.adapters.storage.put('private', k, body, { contentType: String(req.headers['content-type'] ?? typeOf(k)) });
    return { ok: true };
  }

  @Get('*key')
  async publicFile(@Param('key') key: string | string[], @Res() res: Response) {
    const k = Array.isArray(key) ? key.join('/') : key;
    const data = await this.ctx.adapters.storage.get('public', k).catch(() => null);
    if (!data) throw new NotFoundException();
    res.set({ 'Content-Type': typeOf(k), 'Cache-Control': k.startsWith('static/') ? 'public, max-age=3600' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }).send(data);
  }
}
