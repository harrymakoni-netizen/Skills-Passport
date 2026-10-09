import type Redis from 'ioredis';

/** Small key-value port (sessions, 24-hour window tracking, rate limits). Redis in apps, memory in tests. */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSec: number): Promise<number>;
  /** Acquire a short lock; returns a release function or null. */
  lock(key: string, ttlMs: number): Promise<(() => Promise<void>) | null>;
}

export class MemoryKV implements KeyValue {
  private m = new Map<string, { v: string; exp: number | null }>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  private live(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp <= this.now()) {
      this.m.delete(key);
      return null;
    }
    return e;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttlSec?: number) {
    this.m.set(key, { v: value, exp: ttlSec ? this.now() + ttlSec * 1000 : null });
  }
  async del(key: string) {
    this.m.delete(key);
  }
  async incr(key: string, ttlSec: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.m.set(key, { v: String(n), exp: e?.exp ?? this.now() + ttlSec * 1000 });
    return n;
  }
  async lock(key: string, ttlMs: number) {
    if (this.live(key)) return null;
    this.m.set(key, { v: '1', exp: this.now() + ttlMs });
    return async () => void this.m.delete(key);
  }
}

export class RedisKV implements KeyValue {
  constructor(private readonly redis: Redis) {}
  get(key: string) {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.redis.set(key, value, 'EX', ttlSec);
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async incr(key: string, ttlSec: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSec);
    return n;
  }
  async lock(key: string, ttlMs: number) {
    const token = Math.random().toString(36).slice(2);
    const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (!ok) return null;
    return async () => {
      if ((await this.redis.get(key)) === token) await this.redis.del(key);
    };
  }
}
