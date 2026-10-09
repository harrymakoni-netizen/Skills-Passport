import { describe, expect, it } from 'vitest';
import { decideReview, seededRandom, type SamplingInput } from '../src/sampling';
import { cfg, day } from './helpers';

const input = (p: Partial<SamplingInput> = {}): SamplingInput => ({
  job: { disputed: false, flagged: false },
  priorCountedJobs: 5,
  lastDisputeAt: null,
  nearNextLevel: false,
  now: day(100),
  random: () => 0.99,
  ...p,
});

describe('review sampling (SPEC 5)', () => {
  const c = cfg();
  it.each([
    ['disputed job', input({ job: { disputed: true, flagged: true } }), true, 'disputed'],
    ['flagged job', input({ job: { disputed: false, flagged: true } }), true, 'flagged'],
    ['first job', input({ priorCountedJobs: 0 }), true, 'first_jobs'],
    ['third job', input({ priorCountedJobs: 2 }), true, 'first_jobs'],
    ['fourth job, not sampled', input({ priorCountedJobs: 3 }), false, 'not_selected'],
    ['dispute 59 days ago', input({ lastDisputeAt: day(41) }), true, 'recent_dispute'],
    ['dispute exactly 60 days ago', input({ lastDisputeAt: day(40) }), true, 'recent_dispute'],
    ['dispute 61 days ago', input({ lastDisputeAt: day(39) }), false, 'not_selected'],
    ['near next level', input({ nearNextLevel: true }), true, 'pre_level'],
    ['random hit', input({ random: () => 0.1 }), true, 'random'],
    ['random boundary 0.2 not selected', input({ random: () => 0.2 }), false, 'not_selected'],
  ])('%s', (_n, i, review, reason) => {
    expect(decideReview(i, c)).toEqual({ review, reason });
  });

  it('pre-level review can be switched off', () => {
    const off = cfg((x) => (x.sampling.preLevelReview = false));
    expect(decideReview(input({ nearNextLevel: true }), off).reason).toBe('not_selected');
  });

  it('random rate of about 20% over many jobs', () => {
    const rnd = seededRandom(42);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (decideReview(input({ random: rnd }), c).review) hits++;
    expect(hits / 10000).toBeGreaterThan(0.18);
    expect(hits / 10000).toBeLessThan(0.22);
  });

  it('seeded random is deterministic', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
