/* eslint-disable no-console */
/**
 * Seeds reference data (trades, competency units, job types, areas, default config) and — with --demo, or when the
 * database has no artisans — fictional demo users and artisans at different stages. Demo history is created through
 * the real application services (media pipeline, AI mocks, confirmations, reviews) so it behaves like real data.
 * Phone numbers are only in the fictional +26377000xxxx range.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '@sp/config';
import { createAdapters, currentTotp, generateTotpSecret, hashPassword, perceptualHash, photoVariant, totpUri } from '@sp/adapters';
import { DEFAULT_CONFIG, hammingDistance, seededRandom } from '@sp/core';
import type { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { getPrisma } from './client';
import { createServiceContext, createTaskHandlers } from './bootstrap';
import { AREAS, TRADES } from './seed-data';
import { createArtisan } from './services/artisans';
import { confirmJob } from './services/confirmations';
import { attachMedia, createDraftJob, submitJob } from './services/jobs';
import { InlineQueue } from './services/tasks';
import { endorseArtisan, reviewDetail, submitReview } from './services/reviews';
import { recalculateLevel } from './services/levels';
import { MemoryKV } from './services/kv';

const env = loadEnv();
const prisma = getPrisma();
const FIXTURES = join(import.meta.dirname, '../../../fixtures');
export const DEMO_PASSWORD = 'passport-demo-2026';

async function seedReference() {
  for (const [ti, tr] of TRADES.entries()) {
    const trade = await prisma.trade.upsert({
      where: { code: tr.code },
      create: { code: tr.code, nameEn: tr.en, nameSn: tr.sn, nameNd: tr.nd },
      update: { nameEn: tr.en, nameSn: tr.sn, nameNd: tr.nd },
    });
    for (const [i, u] of tr.units.entries()) {
      const title = { en: u.title, sn: u.title, nd: u.title };
      await prisma.competencyUnit.upsert({
        where: { code: u.code },
        create: { code: u.code, tradeId: trade.id, title, description: u.description, evidenceGuidance: u.evidence, sortOrder: i },
        update: { title, description: u.description, evidenceGuidance: u.evidence, sortOrder: i },
      });
    }
    for (const [i, jt] of tr.jobTypes.entries()) {
      const name = { en: jt.name, sn: jt.nameSn ?? jt.name, nd: jt.nameNd ?? jt.name };
      const row = await prisma.jobType.upsert({
        where: { key: jt.key },
        create: { key: jt.key, tradeId: trade.id, name, needsBeforePhoto: jt.needsBefore, sortOrder: i },
        update: { name, needsBeforePhoto: jt.needsBefore, sortOrder: i },
      });
      const units = await prisma.competencyUnit.findMany({ where: { code: { in: jt.units } } });
      await prisma.jobTypeUnit.deleteMany({ where: { jobTypeId: row.id } });
      await prisma.jobTypeUnit.createMany({ data: units.map((u) => ({ jobTypeId: row.id, unitId: u.id })) });
    }
    void ti;
  }
  for (const a of AREAS) {
    await prisma.area.upsert({ where: { city_name: { city: a.city, name: a.name } }, create: a, update: { lat: a.lat, lng: a.lng, cityCode: a.cityCode } });
  }
  const cfg = await prisma.config.findUnique({ where: { version: 1 } });
  if (!cfg) {
    await prisma.config.create({ data: { version: 1, params: DEFAULT_CONFIG as unknown as Prisma.InputJsonValue, activeFrom: new Date('2026-01-01T00:00:00Z'), note: 'Defaults from SPEC sections 5–6 and PLAN §8' } });
  }
  console.log(`✓ ${TRADES.length} trades, ${TRADES.reduce((n, t) => n + t.units.length, 0)} competency units, ${TRADES.reduce((n, t) => n + t.jobTypes.length, 0)} job types, ${AREAS.length} areas, config v1`);
}

/** Empties every application table (keeps the migration history). Development only. */
async function truncateAll() {
  if (env.NODE_ENV === 'production') throw new Error('demo:reset is disabled in production');
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`✓ cleared ${rows.length} tables`);
}

async function main() {
  if (process.argv.includes('--demo')) await truncateAll();
  const demo = process.argv.includes('--demo') || (await prisma.artisan.count()) === 0;
  await seedReference();
  if (!demo) {
    console.log('Demo data already present (run pnpm demo:reset to rebuild).');
    return;
  }
  await seedDemo();
}

async function seedDemo() {
  const realNow = Date.now();
  let clock = realNow;
  const now = () => new Date(clock);
  const setDaysAgo = (d: number, hour = 10) => {
    const t = new Date(realNow - d * 86400000);
    t.setUTCHours(hour - 2, 0, 0, 0); // hour in Africa/Harare (UTC+2)
    clock = Math.min(t.getTime(), realNow);
  };
  const queue = new InlineQueue(now);
  // Seed uses an in-memory channel so the simulator starts with clean chats.
  const adapters = createAdapters({ ...env, MESSAGING_DRIVER: 'mock' }, null);
  const ctx = createServiceContext({ env, redis: null, queue, adapters, kv: new MemoryKV(() => clock), now, random: seededRandom(2026) });
  queue.setHandlers(createTaskHandlers(ctx));
  const { crypto, storage } = adapters;

  // ---------------------------------------------------------------- static assets
  const consent = readFileSync(join(FIXTURES, 'audio/consent-en.wav'));
  for (const l of ['en', 'sn', 'nd']) await storage.put('public', `static/consent-${l}.wav`, consent, { contentType: 'audio/wav' });

  // ---------------------------------------------------------------- staff users
  const logins: string[] = [];
  async function user(role: 'admin' | 'verifier' | 'agent' | 'buyer', name: string, email: string, phone: string, totp: boolean) {
    const secret = totp ? generateTotpSecret() : null;
    const u = await prisma.user.create({
      data: {
        role,
        name,
        emailHash: crypto.lookupHash(email),
        emailEnc: crypto.encrypt(email),
        phoneHash: crypto.phoneHash(phone),
        phoneEnc: crypto.encrypt(phone),
        passwordHash: await hashPassword(DEMO_PASSWORD),
        totpSecretEnc: secret ? crypto.encrypt(secret) : null,
        totpEnabledAt: secret ? new Date(realNow - 200 * 86400000) : null,
        createdAt: new Date(realNow - 200 * 86400000),
      },
    });
    logins.push(`  ${role.padEnd(9)} ${email.padEnd(32)} ${secret ? `TOTP secret ${secret}  (now: ${currentTotp(secret)})\n            ${totpUri(email, secret)}` : 'no TOTP'}`);
    return u;
  }
  const solar = await prisma.trade.findUniqueOrThrow({ where: { code: 'SOL' } });
  const weld = await prisma.trade.findUniqueOrThrow({ where: { code: 'WLD' } });
  const plumb = await prisma.trade.findUniqueOrThrow({ where: { code: 'PLB' } });
  const area = async (name: string) => prisma.area.findFirstOrThrow({ where: { name } });

  await user('admin', 'Nokuthula Admin', 'admin@skillspassport.test', '+263770009001', true);
  const vSolarUser = await user('verifier', 'Farai Chikwanha', 'farai.verifier@skillspassport.test', '+263770009101', true);
  const vWeldUser = await user('verifier', 'Sipho Ndlovu', 'sipho.verifier@skillspassport.test', '+263770009102', true);
  const agentUser = await user('agent', 'Rumbidzai Gumbo', 'rumbi.agent@skillspassport.test', '+263770009201', true);
  const buyerUser = await user('buyer', 'Chipo Mutasa', 'buyer@kuyedza.test', '+263770009301', false);

  const vSolar = await prisma.verifier.create({
    data: { userId: vSolarUser.id, name: 'Farai Chikwanha', areaId: (await area('Glen View')).id, yearsExperience: 18, status: 'active', bio: 'Master electrician and solar installer, Harare.', trades: { create: [{ tradeId: solar.id }] } },
  });
  const vWeld = await prisma.verifier.create({
    data: { userId: vWeldUser.id, name: 'Sipho Ndlovu', areaId: (await area('Makokoba')).id, yearsExperience: 22, status: 'active', bio: 'Boilermaker and fabrication workshop owner.', trades: { create: [{ tradeId: weld.id }] } },
  });
  const agent = await prisma.fieldAgent.create({ data: { userId: agentUser.id, name: 'Rumbidzai Gumbo', areaId: (await area('Mbare')).id } });
  const buyer = await prisma.buyer.create({
    data: {
      userId: buyerUser.id,
      orgName: 'Kuyedza Housing Trust',
      type: 'ngo',
      verified: true,
      contactNameEnc: crypto.encrypt('Chipo Mutasa'),
      contactPhoneEnc: crypto.encrypt('+263770009301'),
      contactPhoneHash: crypto.phoneHash('+263770009301'),
    },
  });

  // ---------------------------------------------------------------- photos
  const usedHashes: string[] = [];
  let variantSeed = 1;
  async function uniquePhoto(file: string): Promise<Buffer> {
    const src = readFileSync(join(FIXTURES, 'photos', file));
    for (;;) {
      const img = await photoVariant(src, variantSeed++);
      const h = await perceptualHash(img);
      if (usedHashes.every((u) => hammingDistance(u, h) >= 14)) {
        usedHashes.push(h);
        return img;
      }
    }
  }
  // The live-demo fixtures must never collide with seeded photos.
  for (const f of ['solar-roof-after.jpg', 'solar-roof-before.jpg', 'solar-inverter-after.jpg', 'solar-inverter-before.jpg', 'weld-gate-after.jpg', 'weld-gate-before.jpg', 'plumb-geyser-after.jpg']) {
    usedHashes.push(await perceptualHash(readFileSync(join(FIXTURES, 'photos', f))));
  }

  let n = 0;
  async function seedJob(o: {
    artisanId: string;
    tradeId: string;
    jobTypeKey: string;
    daysAgo: number;
    client: { name: string; phone: string };
    before?: string[];
    after: string[];
    amount?: number;
    rating?: number | null;
    comment?: string;
    confirm?: boolean;
    review?: { verifierId: string; quality: 'meets' | 'needs_improvement' } | null;
    reuse?: Buffer;
  }) {
    setDaysAgo(o.daysAgo, 9);
    const jt = await prisma.jobType.findUniqueOrThrow({ where: { key: o.jobTypeKey } });
    const a = await prisma.artisan.findUniqueOrThrow({ where: { id: o.artisanId } });
    const { jobId } = await createDraftJob(ctx, { artisanId: o.artisanId, tradeId: o.tradeId, jobTypeId: jt.id });
    const put = async (kind: 'photo_before' | 'photo_after', buf: Buffer) => {
      const key = `originals/seed/${jobId}-${kind}-${n++}.jpg`;
      await storage.put('private', key, buf, { contentType: 'image/jpeg' });
      await attachMedia(ctx, { jobId, kind, originalKey: key, mimeType: 'image/jpeg' });
    };
    for (const f of o.before ?? []) await put('photo_before', await uniquePhoto(f));
    for (const f of o.after) await put('photo_after', await uniquePhoto(f));
    if (o.reuse) await put('photo_after', o.reuse);
    const vkey = `originals/seed/${jobId}-voice.wav`;
    await storage.put('private', vkey, readFileSync(join(FIXTURES, 'audio/voice-note-solar.wav')), { contentType: 'audio/wav' });
    await attachMedia(ctx, { jobId, kind: 'voice', originalKey: vkey, mimeType: 'audio/wav', durationSec: 14 });
    await queue.drain();
    clock += 2 * 3600_000;
    await submitJob(ctx, jobId, {
      clientName: o.client.name,
      clientPhone: o.client.phone,
      jobDate: new Date(clock).toISOString().slice(0, 10),
      areaId: a.areaId,
      location: null,
      amountCents: o.amount ? o.amount * 100 : null,
      notes: [],
    });
    await queue.drain();
    await prisma.job.update({ where: { id: jobId }, data: { summaryConfirmedAt: now() } });
    if (o.confirm === false) return jobId;
    clock += 5 * 3600_000;
    await confirmJob(ctx, jobId, { kind: 'client' }, { rating: o.rating ?? null, comment: o.comment ?? null });
    await queue.drain();
    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status === 'under_review' && o.review) {
      clock += 26 * 3600_000;
      const d = await reviewDetail(ctx, o.review.verifierId, jobId);
      await submitReview(ctx, o.review.verifierId, jobId, { quality: o.review.quality, confirmedUnitIds: d.units.filter((u) => (u.aiConfidence ?? 0) >= 0.88).map((u) => u.id), removedUnitIds: [], note: o.review.quality === 'meets' ? 'Neat, safe work.' : 'Tidy the cable runs and label the breakers.' });
      await queue.drain();
    }
    return jobId;
  }

  const clientPhone = (i: number) => `+26377000${String(2000 + i).padStart(4, '0')}`;
  const C = (i: number, name: string) => ({ name, phone: clientPhone(i) });

  // ---------------------------------------------------------------- Tendai — Silver, solar, Harare
  setDaysAgo(150);
  const tendai = await createArtisan(ctx, {
    phone: '+263770000101', lang: 'en', fullName: 'Tendai Moyo', birthYear: 1998, tradeIds: [solar.id], areaId: (await area('Mbare')).id, areaPending: false,
    experienceYears: 6, howLearned: 'apprenticeship', demographicsConsent: false, gender: null, disability: null, publicBadges: [], profilePhoto: null, consentTextVersion: 'consent-v1',
  });
  const T = { artisanId: tendai.id, tradeId: solar.id };
  const rev = { verifierId: vSolar.id, quality: 'meets' as const };
  await seedJob({ ...T, jobTypeKey: 'solar_battery_inverter_install', daysAgo: 140, client: C(1, 'Mai Chiedza'), before: ['solar-inverter-before.jpg'], after: ['solar-inverter-after.jpg', 'solar-inverter-after.jpg'], amount: 120, rating: 5, comment: 'Arrived on time and explained everything.', review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_panel_mounting', daysAgo: 121, client: C(2, 'Mr Banda'), before: ['solar-roof-before.jpg'], after: ['solar-roof-after.jpg', 'solar-roof-after.jpg'], amount: 80, rating: 4, review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_full_system_install', daysAgo: 104, client: C(3, 'Gogo Mhlanga'), before: ['solar-roof-before.jpg'], after: ['solar-roof-after.jpg', 'solar-inverter-after.jpg'], amount: 450, rating: 5, comment: 'The shop has power all day now.', review: rev });
  setDaysAgo(100);
  await endorseArtisan(ctx, vSolar.id, tendai.id, solar.id, 'I reviewed three of Tendai’s installations. The DC wiring is neat, correctly protected and safe. I would trust Tendai on a full home system.');
  await seedJob({ ...T, jobTypeKey: 'solar_fault_repair', daysAgo: 86, client: C(4, 'Pastor Nyathi'), before: ['solar-inverter-before.jpg'], after: ['solar-inverter-after.jpg'], amount: 35, rating: 4, review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_battery_inverter_install', daysAgo: 64, client: C(5, 'Mrs Zulu'), before: ['solar-inverter-before.jpg'], after: ['solar-inverter-after.jpg', 'solar-inverter-after.jpg'], amount: 140, rating: 5, review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_site_assessment', daysAgo: 47, client: C(6, 'Mr Chari'), after: ['solar-roof-before.jpg'], amount: 15, rating: 4, review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_panel_mounting', daysAgo: 30, client: C(7, 'Mai Tafadzwa'), before: ['solar-roof-before.jpg'], after: ['solar-roof-after.jpg'], amount: 90, rating: 5, comment: 'Very careful on the roof.', review: rev });
  await seedJob({ ...T, jobTypeKey: 'solar_full_system_install', daysAgo: 12, client: C(1, 'Mai Chiedza'), before: ['solar-roof-before.jpg'], after: ['solar-roof-after.jpg', 'solar-inverter-after.jpg'], amount: 520, rating: 5, review: rev });

  // ---------------------------------------------------------------- Rudo — Bronze, welding, Harare (Women in Trades)
  setDaysAgo(70);
  const rudo = await createArtisan(ctx, {
    phone: '+263770000102', lang: 'sn', fullName: 'Rudo Ncube', birthYear: 2001, tradeIds: [weld.id], areaId: (await area('Highfield')).id, areaPending: false,
    experienceYears: 3, howLearned: 'family', demographicsConsent: true, gender: 'woman', disability: 'no', publicBadges: ['women_in_trades'], profilePhoto: null, consentTextVersion: 'consent-v1',
  });
  const R = { artisanId: rudo.id, tradeId: weld.id };
  const wrev = { verifierId: vWeld.id, quality: 'meets' as const };
  await seedJob({ ...R, jobTypeKey: 'wld_gate', daysAgo: 60, client: C(11, 'Mr Moyo'), before: ['weld-gate-before.jpg'], after: ['weld-gate-after.jpg', 'weld-gate-after.jpg'], amount: 260, rating: 5, comment: 'Strong gate, good finish.', review: wrev });
  await seedJob({ ...R, jobTypeKey: 'wld_burglar_bars', daysAgo: 41, client: C(12, 'Mai Rutendo'), after: ['weld-bars-after.jpg', 'weld-bars-after.jpg'], amount: 140, rating: 4, review: wrev });
  const rudoGate = await uniquePhoto('weld-gate-after.jpg');
  await seedJob({ ...R, jobTypeKey: 'wld_gate', daysAgo: 22, client: C(13, 'Baba Tino'), before: ['weld-gate-before.jpg'], after: [], reuse: rudoGate, amount: 300, rating: 5, review: wrev });
  await seedJob({ ...R, jobTypeKey: 'wld_burglar_bars', daysAgo: 6, client: C(14, 'Mrs Sithole'), after: ['weld-bars-after.jpg'], amount: 110, rating: 4, review: null });
  // A job that reuses an earlier photo: duplicate-image flag → verifier queue and admin fraud queue.
  await seedJob({ ...R, jobTypeKey: 'wld_gate', daysAgo: 3, client: C(15, 'Mr Phiri'), after: [], reuse: rudoGate, amount: 280, rating: 5, review: null });

  // ---------------------------------------------------------------- Tinashe — Starter, plumbing, Bulawayo
  setDaysAgo(9);
  const tinashe = await createArtisan(ctx, {
    phone: '+263770000103', lang: 'nd', fullName: 'Tinashe Sibanda', birthYear: 2004, tradeIds: [plumb.id], areaId: (await area('Nkulumane')).id, areaPending: false,
    experienceYears: 1, howLearned: 'self_taught', demographicsConsent: false, gender: null, disability: null, publicBadges: [], profilePhoto: null, consentTextVersion: 'consent-v1', enrolledByAgentId: agent.id,
  });
  await seedJob({ artisanId: tinashe.id, tradeId: plumb.id, jobTypeKey: 'plb_geyser', daysAgo: 1, client: C(21, 'Mr Dube'), before: ['plumb-basin-after.jpg'], after: ['plumb-geyser-after.jpg'], amount: 60, confirm: false });

  // ---------------------------------------------------------------- work request for Tendai
  clock = realNow - 3600_000;
  await prisma.workRequest.create({
    data: { buyerId: buyer.id, artisanId: tendai.id, description: 'Install a 3 kVA backup system at our Mbare community hall: inverter, two batteries and four panels.', areaId: (await area('Mbare')).id, preferredDates: 'Any weekday next week', createdAt: now() },
  });

  clock = realNow;
  await queue.drain();
  for (const a of [tendai, rudo, tinashe]) await recalculateLevel(ctx, a.id, 'seed', { notify: false });

  const summary = await prisma.artisan.findMany({ select: { passportCode: true, displayName: true, level: true, _count: { select: { jobs: true } } }, orderBy: { passportCode: 'asc' } });
  console.log('✓ demo artisans');
  for (const s of summary) console.log(`  ${s.passportCode}  ${s.displayName.padEnd(12)} ${s.level.padEnd(7)} ${s._count.jobs} jobs   ${env.PUBLIC_BASE_URL}/p/${s.passportCode}`);
  console.log(`\n✓ demo logins (password for all: ${DEMO_PASSWORD})`);
  console.log(logins.join('\n'));
  console.log('\n  In development the login page can fill the current TOTP code for you (DEV_TOOLS=true).');

  // Clean simulator chats and sessions from earlier runs.
  try {
    const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 });
    await redis.connect();
    const keys = [...(await redis.keys('mock:*')), ...(await redis.keys('session:*')), ...(await redis.keys('lastin:*')), ...(await redis.keys('lock:*'))];
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    console.log('✓ cleared simulator chats and sessions');
  } catch {
    console.log('· Redis not reachable — skipped clearing simulator chats');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
