import type { RulesConfig } from './config';
import { withinDays } from './time';

export type SamplingReason =
  | 'disputed'
  | 'flagged'
  | 'first_jobs'
  | 'recent_dispute'
  | 'pre_level'
  | 'random'
  | 'not_selected';

export interface SamplingInput {
  job: { disputed: boolean; flagged: boolean };
  /** Number of this artisan's counted jobs before this one. */
  priorCountedJobs: number;
  /** Most recent time the artisan had a disputed job, if any. */
  lastDisputeAt: Date | null;
  /** All other requirements for the next level are met (see levels.isNearNextLevel). */
  nearNextLevel: boolean;
  now: Date;
  /** Injectable randomness in [0, 1) so tests are deterministic. */
  random: () => number;
}

export interface SamplingDecision {
  review: boolean;
  reason: SamplingReason;
}

/** SPEC 5 review sampling. Rules are checked in priority order; the first match wins. */
export function decideReview(input: SamplingInput, config: RulesConfig): SamplingDecision {
  const s = config.sampling;
  if (input.job.disputed) return { review: true, reason: 'disputed' };
  if (input.job.flagged) return { review: true, reason: 'flagged' };
  if (input.priorCountedJobs < s.firstJobsReviewed) return { review: true, reason: 'first_jobs' };
  if (input.lastDisputeAt && withinDays(input.lastDisputeAt, input.now, s.recentDisputeDays)) {
    return { review: true, reason: 'recent_dispute' };
  }
  if (s.preLevelReview && input.nearNextLevel) return { review: true, reason: 'pre_level' };
  if (input.random() < s.randomRate) return { review: true, reason: 'random' };
  return { review: false, reason: 'not_selected' };
}

/** Deterministic PRNG (mulberry32) for reproducible sampling in tests and demos. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
