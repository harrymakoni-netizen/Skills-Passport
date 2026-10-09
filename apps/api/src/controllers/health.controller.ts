import { Controller, Get, Inject } from '@nestjs/common';
import type { ServiceContext } from '@sp/db';
import type Redis from 'ioredis';
import { Public } from '../infra/auth';
import { CTX, REDIS } from '../infra/tokens';

@Controller()
export class HealthController {
  constructor(@Inject(CTX) private readonly ctx: ServiceContext, @Inject(REDIS) private readonly redis: Redis) {}

  @Public()
  @Get('health')
  async health() {
    const db = await this.ctx.prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'down');
    const redis = await this.redis.ping().then(() => 'ok').catch(() => 'down');
    return { status: db === 'ok' && redis === 'ok' ? 'ok' : 'degraded', db, redis, channel: this.ctx.adapters.channel.id, time: this.ctx.now().toISOString() };
  }
}
