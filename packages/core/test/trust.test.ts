import { describe, expect, it } from 'vitest';
import { trustScore } from '../src/trust';
import { cfg } from './helpers';

const c = cfg();
const none = { meets: 0, needsImprovement: 0, reject: 0 };

describe('trust score', () => {
  it.each([
    ['new artisan', { jobsSent: 0, disputedOrRejected: 0, flaggedJobs: 0, reviews: none }, 88],
    ['all good', { jobsSent: 10, disputedOrRejected: 0, flaggedJobs: 0, reviews: { ...none, meets: 4 } }, 100],
    ['all bad', { jobsSent: 4, disputedOrRejected: 4, flaggedJobs: 4, reviews: { ...none, reject: 4 } }, 0],
    ['mixed', { jobsSent: 10, disputedOrRejected: 2, flaggedJobs: 1, reviews: { meets: 2, needsImprovement: 2, reject: 0 } }, 81],
    ['rates capped at 1', { jobsSent: 1, disputedOrRejected: 5, flaggedJobs: 5, reviews: none }, 28],
  ])('%s → %i', (_n, input, expected) => {
    expect(trustScore(input, c)).toBe(expected);
  });

  it('zero weights give 0', () => {
    const z = cfg((x) => Object.assign(x.trust, { weightQuality: 0, weightDisputes: 0, weightFlags: 0 }));
    expect(trustScore({ jobsSent: 1, disputedOrRejected: 0, flaggedJobs: 0, reviews: none }, z)).toBe(0);
  });
});
