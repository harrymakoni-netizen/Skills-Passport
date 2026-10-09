import { beforeEach, describe, expect, it } from 'vitest';
import { createArtisan, deleteArtisan, purgeDeleted } from '../src/services/artisans';
import { pilotReport, createConfigVersion } from '../src/services/admin';
import { searchDirectory } from '../src/services/directory';
import { getPublicPassport } from '../src/services/passport';
import { redactForAi } from '../src/services/ai';
import { createHarness, resetDb } from './harness';

describe('directory, deletion, config and reports (integration)', () => {
  beforeEach(resetDb);

  it('deleting an account takes the page offline now and purges PII after 30 days', async () => {
    const h = createHarness();
    const area = await h.prisma.area.findFirstOrThrow();
    const trade = await h.prisma.trade.findFirstOrThrow();
    const a = await createArtisan(h.ctx, {
      phone: '+263770000111', lang: 'en', fullName: 'Tatenda Mlambo', birthYear: 2000, tradeIds: [trade.id], areaId: area.id, areaPending: false,
      experienceYears: 1, howLearned: 'family', demographicsConsent: false, gender: null, disability: null, publicBadges: [], profilePhoto: null, consentTextVersion: 'v1',
    });
    expect((await searchDirectory(h.ctx, {})).total).toBe(1);
    expect(await getPublicPassport(h.ctx, a.passportCode)).not.toBeNull();
    await deleteArtisan(h.ctx, a.id);
    expect(await getPublicPassport(h.ctx, a.passportCode)).toBeNull();
    expect((await searchDirectory(h.ctx, {})).total).toBe(0);
    expect(await purgeDeleted(h.ctx)).toBe(0);
    h.clock.advance(31 * 86400_000);
    expect(await purgeDeleted(h.ctx)).toBe(1);
    expect(await h.prisma.artisanPii.count()).toBe(0);
    expect((await h.prisma.artisan.findUniqueOrThrow({ where: { id: a.id } })).displayName).toBe('Deleted');
  });

  it('config changes create a new version and validate', async () => {
    const h = createHarness();
    const u = await h.prisma.user.create({ data: { role: 'admin', name: 'A', passwordHash: 'x' } });
    const current = (await h.ctx.config()).params;
    await expect(createConfigVersion(h.ctx, u.id, { ...current, levels: null }, 'broken')).rejects.toThrow();
    const next = structuredClone(current);
    next.levels.bronze.minJobs = 2;
    const r = await createConfigVersion(h.ctx, u.id, next, 'Pilot: easier Bronze');
    expect(r.version).toBe(2);
    expect(await h.prisma.config.count()).toBe(2);
    expect((await h.ctx.config()).params.levels.bronze.minJobs).toBe(2);
    expect(await h.prisma.auditLog.count({ where: { action: 'config.create_version' } })).toBe(1);
  });

  it('pilot report suppresses cells under 5', async () => {
    const h = createHarness();
    const r = await pilotReport(h.ctx, new Date('2026-01-01'), new Date('2027-01-01'));
    expect(r.artisansEnrolled.total).toBe(0);
    expect(r.confirmationRate).toBeNull();
    expect(r.minimumCellSize).toBe(5);
  });

  it('removes phone numbers before text is sent to an AI provider', () => {
    expect(redactForAi('Call me on 077 123 4567 or +263 77 000 1234 after the 3 kVA job')).toBe('Call me on [number] or [number] after the 3 kVA job');
  });
});
