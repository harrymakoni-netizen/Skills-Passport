import { describe, expect, it } from 'vitest';
import { calculateLevel, computeStats, isNearNextLevel, levelRank, requirementsFor, type LevelInput, type LevelJob } from '../src/levels';
import { cfg, day, job } from './helpers';

const base = (p: Partial<LevelInput> = {}): LevelInput => ({
  jobs: [],
  endorsements: [],
  tradeUnits: { SOL: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'] },
  verifiedUnitIds: [],
  currentLevel: 'starter',
  levelFrozen: false,
  ...p,
});

const jobs = (n: number, p: Parameters<typeof job>[0] = {}, start = 0, gapDays = 10) =>
  Array.from({ length: n }, (_, i) => job({ ...p, jobDate: day(start + i * gapDays), confirmedAt: day(start + i * gapDays) }));

const silverReady = () =>
  base({
    jobs: [
      ...jobs(4, { rating: 4, reviewQuality: 'meets' }),
      job({ rating: 5 }),
    ],
    endorsements: [{ verifierId: 'v1', tradeId: 'SOL', withdrawn: false }],
  });

const goldReady = () =>
  base({
    jobs: jobs(12, { rating: 4.5, reviewQuality: 'meets' }, 0, 9),
    endorsements: [
      { verifierId: 'v1', tradeId: 'SOL', withdrawn: false },
      { verifierId: 'v2', tradeId: 'SOL', withdrawn: false },
    ],
    verifiedUnitIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'],
  });

describe('passport levels (SPEC 5)', () => {
  const c = cfg();

  it.each([
    ['no jobs', base(), 'starter'],
    ['2 jobs, 2 clients', base({ jobs: jobs(2) }), 'starter'],
    ['3 jobs, 3 clients', base({ jobs: jobs(3) }), 'bronze'],
    ['3 jobs, 2 clients', base({ jobs: [job({ clientId: 'x' }), job({ clientId: 'x' }), job({ clientId: 'y' })] }), 'starter'],
    ['3 jobs but one rejected', base({ jobs: [...jobs(2), job({ status: 'rejected' })] }), 'starter'],
    ['3 jobs but one disputed', base({ jobs: [...jobs(2), job({ status: 'verified', disputed: true })] }), 'starter'],
    ['3 jobs with resolved dispute', base({ jobs: [...jobs(2), job({ status: 'verified', disputed: true, disputeResolvedForArtisan: true })] }), 'bronze'],
    ['expired / closed jobs do not count', base({ jobs: [...jobs(2), job({ status: 'client_expired' }), job({ status: 'closed' })] }), 'starter'],
    ['silver ready', silverReady(), 'silver'],
    ['gold ready', goldReady(), 'gold'],
  ])('%s → %s', (_name, input, expected) => {
    expect(calculateLevel(input, c).level).toBe(expected);
  });

  it('same client capped at 2 jobs in 30 days for bronze', () => {
    const input = base({ jobs: [job({ clientId: 'x', confirmedAt: day(1) }), job({ clientId: 'x', confirmedAt: day(2) }), job({ clientId: 'x', confirmedAt: day(3) }), job({ clientId: 'y' }), job({ clientId: 'z' })] });
    const r = calculateLevel(input, c);
    expect(r.stats.countedJobs).toBe(4);
    expect(r.level).toBe('bronze');
  });

  describe('silver requirements', () => {
    it.each([
      ['no endorsement', (i: LevelInput) => ({ ...i, endorsements: [] })],
      ['withdrawn endorsement', (i: LevelInput) => ({ ...i, endorsements: [{ verifierId: 'v1', tradeId: 'SOL', withdrawn: true }] })],
      ['rating below 3.5', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j) => ({ ...j, rating: 3 })) })],
      ['fewer than 3 ratings', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j, n) => ({ ...j, rating: n < 2 ? 5 : null })) })],
      ['no meets-standard review', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j) => ({ ...j, reviewQuality: null })) })],
      ['an open dispute', (i: LevelInput) => ({ ...i, jobs: [...i.jobs, job({ status: 'client_disputed', disputed: true })] })],
      ['an open dispute under review', (i: LevelInput) => ({ ...i, jobs: [...i.jobs, job({ status: 'under_review', disputed: true })] })],
      ['only 4 jobs', (i: LevelInput) => ({ ...i, jobs: i.jobs.slice(0, 4) })],
    ])('drops to bronze with %s', (_n, mutate) => {
      expect(calculateLevel(mutate(silverReady()), c).level).toBe('bronze');
    });

    it('rating exactly 3.5 passes', () => {
      const i = silverReady();
      const r = calculateLevel({ ...i, jobs: i.jobs.map((j, n) => ({ ...j, rating: n % 2 ? 3 : 4 })) }, c);
      // ratings 4,3,4,3,4 → 3.6
      expect(r.stats.averageRating).toBe(3.6);
      expect(r.level).toBe('silver');
      const r2 = calculateLevel({ ...i, jobs: (i.jobs.slice(0, 4).map((j, n) => ({ ...j, rating: n % 2 ? 3 : 4 })) as LevelJob[]).concat(job({ rating: null, reviewQuality: 'meets' })) }, c);
      expect(r2.stats.averageRating).toBe(3.5);
    });

    it('a resolved dispute is not open', () => {
      const i = silverReady();
      const r = calculateLevel({ ...i, jobs: [...i.jobs, job({ status: 'under_review', disputed: true, disputeResolvedForArtisan: true })] }, c);
      expect(r.stats.openDisputes).toBe(0);
      expect(r.level).toBe('silver');
    });
  });

  describe('gold requirements', () => {
    it.each([
      ['span under 90 days', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j, n) => ({ ...j, jobDate: day(n) })) })],
      ['one endorsing verifier', (i: LevelInput) => ({ ...i, endorsements: [...i.endorsements.slice(0, 1), { verifierId: 'v1', tradeId: 'X', withdrawn: false }] })],
      ['under 70% of units verified', (i: LevelInput) => ({ ...i, verifiedUnitIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'] })],
      ['fewer than 8 clients', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j, n) => ({ ...j, clientId: `k${n % 7}`, confirmedAt: day(n * 40) })) })],
      ['only 2 meets reviews', (i: LevelInput) => ({ ...i, jobs: i.jobs.map((j, n) => ({ ...j, reviewQuality: n < 2 ? 'meets' as const : null })) })],
    ])('falls back to silver with %s', (_n, mutate) => {
      expect(calculateLevel(mutate(goldReady()), c).level).toBe('silver');
    });

    it('70% rule met by any one trade (PLAN Q2)', () => {
      const i = goldReady();
      const r = calculateLevel({ ...i, tradeUnits: { WLD: ['w1', 'w2'], SOL: i.tradeUnits.SOL! } }, c);
      expect(r.stats.bestTradeId).toBe('SOL');
      expect(r.level).toBe('gold');
    });

    it('trade with no units is ignored', () => {
      const r = computeStats({ ...goldReady(), tradeUnits: { NONE: [] } }, c);
      expect(r.bestVerifiedUnitShare).toBe(0);
      expect(r.bestTradeId).toBeNull();
    });

    it('gold also requires silver rating rule (levels are cumulative)', () => {
      const i = goldReady();
      expect(calculateLevel({ ...i, jobs: i.jobs.map((j) => ({ ...j, rating: 2 })) }, c).level).toBe('bronze');
    });
  });

  it('levels go down when jobs are rejected (downgrade)', () => {
    const i = silverReady();
    const r = calculateLevel({ ...i, currentLevel: 'silver', jobs: i.jobs.map((j, n) => (n < 3 ? { ...j, status: 'rejected' as const } : j)) }, c);
    expect(r.level).toBe('starter');
  });

  it('frozen artisans keep their current level', () => {
    const r = calculateLevel({ ...base(), currentLevel: 'silver', levelFrozen: true }, c);
    expect(r.level).toBe('silver');
    expect(r.computedLevel).toBe('starter');
    expect(r.frozen).toBe(true);
    expect(r.next?.level).toBe('gold');
  });

  it('next-level checklist lists what is missing', () => {
    const r = calculateLevel(base({ jobs: [job({ clientId: 'x' })] }), c);
    expect(r.next?.level).toBe('bronze');
    expect(r.next?.missing.map((m) => [m.key, m.have, m.need])).toEqual([
      ['jobs', 1, 3],
      ['clients', 1, 3],
    ]);
  });

  it('gold has no next level', () => {
    expect(calculateLevel(goldReady(), c).next).toBeNull();
  });

  it('starter has no requirements', () => {
    expect(requirementsFor('starter', computeStats(base(), c), c)).toEqual([]);
  });

  it('thresholds come from config', () => {
    const easy = cfg((x) => {
      x.levels.bronze.minJobs = 1;
      x.levels.bronze.minClients = 1;
    });
    expect(calculateLevel(base({ jobs: jobs(1) }), easy).level).toBe('bronze');
  });

  it('levelRank orders levels', () => {
    expect(levelRank('starter')).toBeLessThan(levelRank('bronze'));
    expect(levelRank('gold')).toBe(3);
  });

  it('isNearNextLevel only when review-only items are missing', () => {
    const i = silverReady();
    const noReview = { ...i, jobs: i.jobs.map((j) => ({ ...j, reviewQuality: null })), endorsements: [] };
    expect(isNearNextLevel(calculateLevel(noReview, c))).toBe(true);
    expect(isNearNextLevel(calculateLevel(base({ jobs: jobs(1) }), c))).toBe(false);
    expect(isNearNextLevel(calculateLevel(goldReady(), c))).toBe(false);
  });

  it('accepts verified units as a Set', () => {
    const i = goldReady();
    expect(calculateLevel({ ...i, verifiedUnitIds: new Set(i.verifiedUnitIds as string[]) }, c).level).toBe('gold');
  });

  it('span is zero with no counted jobs', () => {
    expect(computeStats(base(), c).spanDays).toBe(0);
    expect(computeStats(base(), c).averageRating).toBeNull();
  });
});
