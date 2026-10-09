import type { RulesConfig } from './config';
import { type CountableJob, selectCountedJobs } from './jobs';
import { DAY_MS } from './time';

export const LEVELS = ['starter', 'bronze', 'silver', 'gold'] as const;
export type Level = (typeof LEVELS)[number];

export function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

export type ReviewQuality = 'meets' | 'needs_improvement' | 'reject';

export interface LevelJob extends CountableJob {
  jobDate: Date;
  /** Client rating 1–5, if given. */
  rating: number | null;
  /** Verifier's quality rating, if reviewed. */
  reviewQuality: ReviewQuality | null;
}

export interface LevelEndorsement {
  verifierId: string;
  tradeId: string;
  withdrawn: boolean;
}

export interface LevelInput {
  jobs: readonly LevelJob[];
  endorsements: readonly LevelEndorsement[];
  /** Active competency unit ids for each of the artisan's trades. */
  tradeUnits: Readonly<Record<string, readonly string[]>>;
  /** Unit ids with status "verified" (see competency.ts). */
  verifiedUnitIds: ReadonlySet<string> | readonly string[];
  currentLevel: Level;
  /** Fraud rule: level changes frozen pending admin review. */
  levelFrozen: boolean;
}

export type ChecklistKey =
  | 'jobs'
  | 'clients'
  | 'endorsements'
  | 'endorsing_verifiers'
  | 'rating'
  | 'ratings_count'
  | 'no_open_disputes'
  | 'meets_reviews'
  | 'span_days'
  | 'verified_units';

export interface ChecklistItem {
  key: ChecklistKey;
  met: boolean;
  have: number;
  need: number;
}

export interface LevelStats {
  countedJobs: number;
  distinctClients: number;
  activeEndorsements: number;
  endorsingVerifiers: number;
  averageRating: number | null;
  ratingsCount: number;
  openDisputes: number;
  meetsReviews: number;
  spanDays: number;
  /** Best share of verified units across the artisan's trades (0–1). */
  bestVerifiedUnitShare: number;
  bestTradeId: string | null;
  countedJobIds: string[];
}

export interface LevelResult {
  level: Level;
  /** Level the rules would give if not frozen. */
  computedLevel: Level;
  frozen: boolean;
  stats: LevelStats;
  /** Requirements for the next level (null at Gold). */
  next: { level: Level; items: ChecklistItem[]; missing: ChecklistItem[] } | null;
}

export function computeStats(input: LevelInput, config: RulesConfig): LevelStats {
  const countedIds = selectCountedJobs(input.jobs, {
    maxPerClient: config.fraud.sameClientMaxPerArtisan,
    windowDays: config.fraud.sameClientWindowDays,
  });
  const counted = input.jobs.filter((j) => countedIds.has(j.id));
  const clients = new Set(counted.map((j) => j.clientId).filter((c): c is string => !!c));
  const ratings = counted.map((j) => j.rating).filter((r): r is number => typeof r === 'number');
  const active = input.endorsements.filter((e) => !e.withdrawn);
  const verifiers = new Set(active.map((e) => e.verifierId));
  const openDisputes = input.jobs.filter(
    (j) => j.disputed && !j.disputeResolvedForArtisan && (j.status === 'client_disputed' || j.status === 'under_review'),
  ).length;
  const meetsReviews = counted.filter((j) => j.reviewQuality === 'meets').length;

  let spanDays = 0;
  if (counted.length > 0) {
    const times = counted.map((j) => j.jobDate.getTime());
    spanDays = Math.floor((Math.max(...times) - Math.min(...times)) / DAY_MS);
  }

  const verified = input.verifiedUnitIds instanceof Set ? input.verifiedUnitIds : new Set(input.verifiedUnitIds);
  let best = 0;
  let bestTradeId: string | null = null;
  for (const [tradeId, units] of Object.entries(input.tradeUnits)) {
    if (units.length === 0) continue;
    const share = units.filter((u) => verified.has(u)).length / units.length;
    if (share > best || bestTradeId === null) {
      best = share;
      bestTradeId = tradeId;
    }
  }

  return {
    countedJobs: counted.length,
    distinctClients: clients.size,
    activeEndorsements: active.length,
    endorsingVerifiers: verifiers.size,
    averageRating: ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
    ratingsCount: ratings.length,
    openDisputes,
    meetsReviews,
    spanDays,
    bestVerifiedUnitShare: best,
    bestTradeId,
    countedJobIds: counted.map((j) => j.id),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const item = (key: ChecklistKey, have: number, need: number, met = have >= need): ChecklistItem => ({
  key,
  have,
  need,
  met,
});

/** Requirements to hold `level`. Levels are cumulative: Gold also requires everything for Silver. */
export function requirementsFor(level: Level, s: LevelStats, config: RulesConfig): ChecklistItem[] {
  const { bronze, silver, gold } = config.levels;
  switch (level) {
    case 'starter':
      return [];
    case 'bronze':
      return [item('jobs', s.countedJobs, bronze.minJobs), item('clients', s.distinctClients, bronze.minClients)];
    case 'silver': {
      const ratingMet = s.ratingsCount >= silver.minRatings && (s.averageRating ?? 0) >= silver.minAvgRating;
      return [
        item('jobs', s.countedJobs, silver.minJobs),
        item('clients', s.distinctClients, silver.minClients),
        item('endorsements', s.activeEndorsements, silver.minEndorsements),
        item('ratings_count', s.ratingsCount, silver.minRatings),
        { key: 'rating', have: s.averageRating ?? 0, need: silver.minAvgRating, met: ratingMet },
        item('no_open_disputes', s.openDisputes, 0, s.openDisputes === 0),
        item('meets_reviews', s.meetsReviews, silver.minMeetsReviews),
      ];
    }
    case 'gold': {
      const silverItems = requirementsFor('silver', s, config).filter(
        (i) => !['jobs', 'clients', 'meets_reviews', 'endorsements'].includes(i.key),
      );
      return [
        item('jobs', s.countedJobs, gold.minJobs),
        item('span_days', s.spanDays, gold.minSpanDays),
        item('clients', s.distinctClients, gold.minClients),
        item('endorsing_verifiers', s.endorsingVerifiers, gold.minEndorsingVerifiers),
        {
          key: 'verified_units',
          have: Math.round(s.bestVerifiedUnitShare * 100),
          need: Math.round(gold.minVerifiedUnitShare * 100),
          met: s.bestVerifiedUnitShare >= gold.minVerifiedUnitShare,
        },
        item('meets_reviews', s.meetsReviews, gold.minMeetsReviews),
        ...silverItems,
      ];
    }
  }
}

/** SPEC 5: recalculated after every job status change. Levels can go down. */
export function calculateLevel(input: LevelInput, config: RulesConfig): LevelResult {
  const stats = computeStats(input, config);
  let computed: Level = 'starter';
  for (const level of LEVELS.slice(1)) {
    if (requirementsFor(level, stats, config).every((i) => i.met)) computed = level;
    else break;
  }
  const level = input.levelFrozen ? input.currentLevel : computed;
  const nextLevel = LEVELS[levelRank(level) + 1];
  let next: LevelResult['next'] = null;
  if (nextLevel) {
    const items = requirementsFor(nextLevel, stats, config);
    next = { level: nextLevel, items, missing: items.filter((i) => !i.met) };
  }
  return { level, computedLevel: computed, frozen: input.levelFrozen, stats, next };
}

/**
 * True when every requirement for the next level is met except those that only a review can satisfy
 * (meets-standard reviews, endorsements, verified units). Used by review sampling (PLAN Q11).
 */
export function isNearNextLevel(result: LevelResult): boolean {
  if (!result.next) return false;
  const reviewOnly: ChecklistKey[] = ['meets_reviews', 'endorsements', 'endorsing_verifiers', 'verified_units'];
  return result.next.missing.length > 0 && result.next.missing.every((i) => reviewOnly.includes(i.key));
}
