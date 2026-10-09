import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@sp/adapters';
import { createArtisan } from '../src/services/artisans';
import { confirmJob } from '../src/services/confirmations';
import { attachMedia, createDraftJob, submitJob } from '../src/services/jobs';
import { ForbiddenError, endorseArtisan, reviewDetail, reviewQueue, submitReview } from '../src/services/reviews';
import { createWorkRequest, respondWorkRequest } from '../src/services/workRequests';
import { reportClient } from '../src/services/safety';
import { checkClientPhone } from '../src/services/jobs';
import { createHarness, resetDb } from './harness';

async function setup() {
  const h = createHarness();
  const { ctx, prisma } = h;
  const solar = await prisma.trade.findUniqueOrThrow({ where: { code: 'SOL' } });
  const weld = await prisma.trade.findUniqueOrThrow({ where: { code: 'WLD' } });
  const area = await prisma.area.findFirstOrThrow({ where: { name: 'Mbare' } });
  const mkVerifier = async (name: string, tradeId: string, phone: string) => {
    const u = await prisma.user.create({ data: { role: 'verifier', name, passwordHash: await hashPassword('x'), phoneHash: ctx.adapters.crypto.phoneHash(phone) } });
    return prisma.verifier.create({ data: { userId: u.id, name, yearsExperience: 10, status: 'active', trades: { create: [{ tradeId }] } } });
  };
  const vSolar = await mkVerifier('Farai', solar.id, '+263770009101');
  const vWeld = await mkVerifier('Sipho', weld.id, '+263770009102');
  const a = await createArtisan(ctx, {
    phone: '+263770000101', lang: 'en', fullName: 'Tendai Moyo', birthYear: 1998, tradeIds: [solar.id], areaId: area.id, areaPending: false,
    experienceYears: 6, howLearned: 'apprenticeship', demographicsConsent: false, gender: null, disability: null, publicBadges: [], profilePhoto: null, consentTextVersion: 'v1',
  });
  const jt = await prisma.jobType.findUniqueOrThrow({ where: { key: 'solar_battery_inverter_install' } });
  const photos = ['solar-inverter-after.jpg', 'solar-roof-after.jpg', 'weld-gate-after.jpg', 'plumb-geyser-after.jpg'];
  async function job(i: number) {
    const { jobId } = await createDraftJob(ctx, { artisanId: a.id, tradeId: solar.id, jobTypeId: jt.id });
    const { readFileSync } = await import('node:fs');
    const key = `originals/t/${jobId}.jpg`;
    await ctx.adapters.storage.put('private', key, readFileSync(new URL(`../../../fixtures/photos/${photos[i % photos.length]}`, import.meta.url)));
    await attachMedia(ctx, { jobId, kind: 'photo_after', originalKey: key, mimeType: 'image/jpeg' });
    await h.queue.drain();
    await submitJob(ctx, jobId, { clientName: `Client ${i}`, clientPhone: `+26377000${3000 + i}`, jobDate: '2026-10-08', areaId: area.id, location: null, amountCents: null, notes: [] });
    await h.queue.drain();
    await confirmJob(ctx, jobId, { kind: 'client' }, { rating: 5 });
    await h.queue.drain();
    return jobId;
  }
  return { h, ctx, prisma, a, vSolar, vWeld, solar, job };
}

describe('verifier review, endorsements and permissions (integration)', () => {
  beforeEach(resetDb);

  it('queue shows the verifier’s trade only; reviewing verifies units; endorsement after 3 meets → Silver path', async () => {
    const { ctx, prisma, a, vSolar, vWeld, solar, job } = await setup();
    const ids = [await job(0), await job(1), await job(2)];
    expect((await reviewQueue(ctx, vSolar.id)).map((q) => q.id).sort()).toEqual([...ids].sort());
    expect(await reviewQueue(ctx, vWeld.id)).toEqual([]);
    await expect(reviewDetail(ctx, vWeld.id, ids[0]!)).rejects.toBeInstanceOf(ForbiddenError);

    for (const id of ids) {
      const d = await reviewDetail(ctx, vSolar.id, id);
      expect(d.endorsement.eligible).toBe(false);
      await submitReview(ctx, vSolar.id, id, { quality: 'meets', confirmedUnitIds: d.units.slice(0, 2).map((u) => u.id), removedUnitIds: [] });
    }
    expect(await prisma.job.count({ where: { status: 'verified' } })).toBe(3);
    await expect(submitReview(ctx, vSolar.id, ids[0]!, { quality: 'meets', confirmedUnitIds: [], removedUnitIds: [] })).rejects.toBeInstanceOf(ForbiddenError);

    await endorseArtisan(ctx, vSolar.id, a.id, solar.id, 'Neat and safe DC wiring on three installations.');
    await expect(endorseArtisan(ctx, vSolar.id, a.id, solar.id, 'Second endorsement for the same trade')).rejects.toThrow(/already_endorsed/);
    await expect(endorseArtisan(ctx, vWeld.id, a.id, solar.id, 'Not my trade at all, should fail here')).rejects.toThrow();
    expect((await prisma.artisan.findUniqueOrThrow({ where: { id: a.id } })).level).toBe('bronze');
  });

  it('enforces declared conflicts of interest', async () => {
    const { ctx, prisma, a, vSolar, solar, job } = await setup();
    const id = await job(0);
    await prisma.verifierConflict.create({ data: { verifierId: vSolar.id, artisanId: a.id, reason: 'My apprentice' } });
    expect(await reviewQueue(ctx, vSolar.id)).toEqual([]);
    await expect(reviewDetail(ctx, vSolar.id, id)).rejects.toThrow(/conflict/);
    await expect(endorseArtisan(ctx, vSolar.id, a.id, solar.id, 'Should be refused because of the conflict')).rejects.toThrow(/conflict/);
    expect(await prisma.fraudFlag.count({ where: { rule: 'FR10_verifier_conflict' } })).toBe(1);
  });

  it('a rejected job stops counting and the level goes down', async () => {
    const { ctx, prisma, a, vSolar, job } = await setup();
    const ids = [await job(0), await job(1), await job(2)];
    expect((await prisma.artisan.findUniqueOrThrow({ where: { id: a.id } })).level).toBe('bronze');
    await submitReview(ctx, vSolar.id, ids[0]!, { quality: 'reject', confirmedUnitIds: [], removedUnitIds: [] });
    expect((await prisma.artisan.findUniqueOrThrow({ where: { id: a.id } })).level).toBe('starter');
    expect(await prisma.levelHistory.count({ where: { artisanId: a.id, toLevel: 'starter' } })).toBe(1);
  });

  it('work requests hide contacts until accepted; reported clients are blocked', async () => {
    const { ctx, prisma, a } = await setup();
    const u = await prisma.user.create({ data: { role: 'buyer', name: 'Chipo', passwordHash: 'x' } });
    const crypto = ctx.adapters.crypto;
    const buyer = await prisma.buyer.create({ data: { userId: u.id, orgName: 'Kuyedza', type: 'ngo', contactNameEnc: crypto.encrypt('Chipo'), contactPhoneEnc: crypto.encrypt('+263770009301'), contactPhoneHash: crypto.phoneHash('+263770009301') } });
    const area = await prisma.area.findFirstOrThrow();
    const wr = await createWorkRequest(ctx, { buyerId: buyer.id, artisanCode: 'SP-HRE-00001', description: 'Install a backup system', areaId: area.id, preferredDates: 'Next week' });
    const res = await respondWorkRequest(ctx, { artisanId: a.id, requestId: wr.id, accept: true });
    expect(res).toMatchObject({ ok: true, contactName: 'Chipo', contactPhone: '+263770009301' });
    expect(await respondWorkRequest(ctx, { artisanId: a.id, requestId: wr.id, accept: true })).toEqual({ ok: false });

    // Two different artisans report the same client → blocked.
    const client = await prisma.client.create({ data: { phoneHash: crypto.phoneHash('+263770003999'), phoneEnc: crypto.encrypt('+263770003999') } });
    await reportClient(ctx, { artisanId: a.id, clientId: client.id, reason: 'unsafe' });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).blocked).toBe(false);
    await reportClient(ctx, { artisanId: a.id, clientId: client.id, reason: 'unsafe' });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).blocked).toBe(false);
    const other = await createArtisan(ctx, {
      phone: '+263770000105', lang: 'en', fullName: 'Rudo Ncube', birthYear: 2001, tradeIds: [a.trades[0]!.id], areaId: area.id, areaPending: false,
      experienceYears: 1, howLearned: 'family', demographicsConsent: false, gender: null, disability: null, publicBadges: [], profilePhoto: null, consentTextVersion: 'v1',
    });
    await reportClient(ctx, { artisanId: other.id, clientId: client.id, reason: 'harassment' });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).blocked).toBe(true);
    expect(await checkClientPhone(ctx, { artisanId: a.id, phone: '+263770003999' })).toBe('blocked');
    expect(await checkClientPhone(ctx, { artisanId: a.id, phone: '+263770009101' })).toBe('registered'); // a verifier
  });
});
