import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { createAdapters, createLogger, generateTotpSecret, currentTotp, hashPassword } from '@sp/adapters';
import { envSchema } from '@sp/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, resetDb } from '../../../packages/db/test/harness';
import { createApp } from '../src/app';

const fakeRedis = { ping: async () => 'PONG' } as never;
const log = createLogger({ name: 'test', level: 'fatal' });

async function makeApp(overrides: Record<string, string> = {}) {
  const h = createHarness();
  const env = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    PII_ENCRYPTION_KEY: 'x'.repeat(43) + '=',
    PHONE_HASH_PEPPER: 'test-pepper-0123456789-0123456789-abc',
    JWT_SECRET: 'test-jwt-secret-0123456789-0123456789',
    WHATSAPP_VERIFY_TOKEN: 'verify-me',
    ...overrides,
  });
  if (env.MESSAGING_DRIVER === 'whatsapp') {
    const real = createAdapters({ ...env, STORAGE_DRIVER: 'fs' }, null);
    Object.assign(h.ctx, { adapters: { ...h.ctx.adapters, channel: real.channel, mock: null } });
  }
  const app = await createApp({ env, ctx: h.ctx, redis: fakeRedis, log });
  await app.init();
  return { app, h, env };
}

async function staff(h: ReturnType<typeof createHarness>, role: 'admin' | 'verifier' | 'agent' | 'buyer', email: string) {
  const { crypto } = h.ctx.adapters;
  const secret = generateTotpSecret();
  const u = await h.prisma.user.create({
    data: { role, name: role, emailHash: crypto.lookupHash(email), emailEnc: crypto.encrypt(email), passwordHash: await hashPassword('correct horse battery'), totpSecretEnc: role === 'buyer' ? null : crypto.encrypt(secret), totpEnabledAt: role === 'buyer' ? null : new Date() },
  });
  if (role === 'verifier') {
    const t = await h.prisma.trade.findFirstOrThrow({ where: { code: 'SOL' } });
    await h.prisma.verifier.create({ data: { userId: u.id, name: 'V', yearsExperience: 10, status: 'active', trades: { create: [{ tradeId: t.id }] } } });
  }
  if (role === 'agent') await h.prisma.fieldAgent.create({ data: { userId: u.id, name: 'Agent' } });
  return { user: u, secret };
}

async function signIn(app: INestApplication, email: string, secret?: string) {
  const agent = request.agent(app.getHttpServer());
  const r1 = await agent.post('/auth/login').send({ email, password: 'correct horse battery' }).expect(200);
  if (r1.body.next === 'totp') await agent.post('/auth/totp').send({ challenge: r1.body.challenge, code: currentTotp(secret!) }).expect(200);
  return agent;
}

describe('API (integration)', () => {
  let app: INestApplication;
  let h: ReturnType<typeof createHarness>;
  let secrets: Record<string, string>;

  beforeAll(async () => {
    await resetDb();
    ({ app, h } = await makeApp());
    secrets = {};
    for (const [role, email] of [['admin', 'a@t.test'], ['verifier', 'v@t.test'], ['agent', 'g@t.test'], ['buyer', 'b@t.test']] as const) {
      secrets[role] = (await staff(h, role, email)).secret;
    }
  });
  afterAll(async () => app?.close());

  it('health', async () => {
    const r = await request(app.getHttpServer()).get('/health').expect(200);
    expect(r.body).toMatchObject({ status: 'ok', db: 'ok', channel: 'mock' });
  });

  it('requires a session and the right role', async () => {
    await request(app.getHttpServer()).get('/reviews/queue').expect(401);
    const agent = await signIn(app, 'g@t.test', secrets.agent);
    await agent.get('/reviews/queue').expect(403); // agents cannot review
    await agent.post('/jobs/x/review').set('x-sp-csrf', '1').send({ quality: 'meets', confirmedUnitIds: [], removedUnitIds: [] }).expect(403);
    await agent.post('/artisans/x/endorse').set('x-sp-csrf', '1').send({ statement: 'x'.repeat(30) }).expect(403); // agents cannot endorse
    await agent.get('/admin/flags').expect(403);
    const verifier = await signIn(app, 'v@t.test', secrets.verifier);
    await verifier.get('/reviews/queue').expect(200);
    await verifier.get('/admin/overview').expect(403);
    await verifier.get('/agent/tasks').expect(403);
    const buyer = await signIn(app, 'b@t.test');
    await buyer.get('/directory').expect(200);
    await buyer.get('/reviews/queue').expect(403);
    const admin = await signIn(app, 'a@t.test', secrets.admin);
    await admin.get('/admin/overview').expect(200);
  });

  it('rejects wrong passwords and wrong TOTP codes', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'a@t.test', password: 'nope' }).expect(401);
    const r = await request(app.getHttpServer()).post('/auth/login').send({ email: 'a@t.test', password: 'correct horse battery' }).expect(200);
    expect(r.body.next).toBe('totp');
    await request(app.getHttpServer()).post('/auth/totp').send({ challenge: r.body.challenge, code: '000000' }).expect(401);
  });

  it('requires the CSRF header on mutations', async () => {
    const admin = await signIn(app, 'a@t.test', secrets.admin);
    await admin.post('/admin/flags/x/resolve').send({ decision: 'clear', note: 'abc' }).expect(403);
  });

  it('webhook: verification handshake, and signed POSTs only when WhatsApp is on', async () => {
    const s = app.getHttpServer();
    const ok = await request(s).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '42' }).expect(200);
    expect(ok.text).toBe('42');
    await request(s).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '42' }).expect(403);
    await request(s).post('/webhooks/whatsapp').send({ entry: [] }).expect(401);
  });

  it('public passport never exposes phone numbers', async () => {
    const r = await request(app.getHttpServer()).get('/public/passports/SP-HRE-99999').expect(404);
    expect(r.body.message).toBeTruthy();
    const dir = await request(app.getHttpServer()).get('/public/directory').expect(200);
    expect(JSON.stringify(dir.body)).not.toMatch(/\+263/);
  });

  it('client confirmation endpoints validate tokens', async () => {
    const r = await request(app.getHttpServer()).get('/public/confirmations/not-a-valid-token-xyz').expect(200);
    expect(r.body.state).toBe('invalid');
  });
});

describe('API with DEV_TOOLS off (production-like)', () => {
  it('has no /dev routes', async () => {
    const { app } = await makeApp({ DEV_TOOLS: 'false' });
    await request(app.getHttpServer()).get('/dev/fixtures').expect(404);
    await request(app.getHttpServer()).post('/dev/mock/inbound').send({}).expect(404);
    await app.close();
  });

  it('signed webhook accepted when the WhatsApp adapter is configured', async () => {
    const { app } = await makeApp({ MESSAGING_DRIVER: 'whatsapp', WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_APP_SECRET: 'shh' });
    const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.x', status: 'delivered', timestamp: '1760000000' }] } }] }] });
    const sig = `sha256=${createHmac('sha256', 'shh').update(body).digest('hex')}`;
    await request(app.getHttpServer()).post('/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sig).send(body).expect(200);
    await request(app.getHttpServer()).post('/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', 'sha256=bad').send(body).expect(401);
    await app.close();
  });
});
