import { z } from 'zod';

/**
 * Every threshold used by the rules engine. Stored as versioned rows in the `configs` table and validated
 * with this schema. Defaults below are the values in SPEC sections 5–6 plus the decisions in docs/PLAN.md §8.
 */
export const rulesConfigSchema = z.object({
  levels: z.object({
    bronze: z.object({ minJobs: z.number().int(), minClients: z.number().int() }),
    silver: z.object({
      minJobs: z.number().int(),
      minClients: z.number().int(),
      minEndorsements: z.number().int(),
      minAvgRating: z.number(),
      /** Minimum number of client ratings before the average-rating rule can be met (PLAN Q10). */
      minRatings: z.number().int(),
      /** Reviewed jobs rated "meets standard" (SPEC 5, review sampling table). */
      minMeetsReviews: z.number().int(),
    }),
    gold: z.object({
      minJobs: z.number().int(),
      /** Days between the first and the last counted job date (PLAN Q9). */
      minSpanDays: z.number().int(),
      minClients: z.number().int(),
      minEndorsingVerifiers: z.number().int(),
      /** Share of a trade's active units that must be verified (any one trade, PLAN Q2). */
      minVerifiedUnitShare: z.number().min(0).max(1),
      minMeetsReviews: z.number().int(),
    }),
  }),
  sampling: z.object({
    firstJobsReviewed: z.number().int(),
    randomRate: z.number().min(0).max(1),
    recentDisputeDays: z.number().int(),
    /** Review every new counted job once all other requirements for the next level are met (PLAN Q11). */
    preLevelReview: z.boolean(),
  }),
  competency: z.object({
    pendingMinConfidence: z.number().min(0).max(1),
    pendingMinJobs: z.number().int(),
  }),
  endorsement: z.object({ minMeetsReviews: z.number().int() }),
  fraud: z.object({
    sameClientMaxPerArtisan: z.number().int(),
    sameClientWindowDays: z.number().int(),
    ringMaxArtisans: z.number().int(),
    ringWindowDays: z.number().int(),
    /** Hamming distance between 64-bit perceptual hashes below which two images are duplicates. */
    phashMaxDistance: z.number().int(),
    captureDateMaxDaysBefore: z.number().int(),
    locationMaxKm: z.number(),
    recentRegistrationHours: z.number().int(),
    freezeIncidents: z.number().int(),
    freezeWindowDays: z.number().int(),
    verifierApprovalRateMax: z.number().min(0).max(1),
    verifierApprovalMinReviews: z.number().int(),
  }),
  confirmation: z.object({
    reminderHours: z.array(z.number().int()),
    expiryDays: z.number().int(),
  }),
  clients: z.object({
    /** Distinct artisans reporting a client before the client is blocked (PLAN Q14). */
    blockAtReports: z.number().int(),
  }),
  media: z.object({
    maxBeforePhotos: z.number().int(),
    maxAfterPhotos: z.number().int(),
    maxVideoSeconds: z.number().int(),
    maxVoiceSeconds: z.number().int(),
    /** Quality score (0–1) below which the artisan is asked for a retake. */
    minQuality: z.number().min(0).max(1),
  }),
  trust: z.object({
    weightQuality: z.number(),
    weightDisputes: z.number(),
    weightFlags: z.number(),
    /** Quality score used before any review exists. */
    priorQuality: z.number().min(0).max(1),
  }),
  workRequests: z.object({ followUpDays: z.number().int(), expiryDays: z.number().int() }),
});

export type RulesConfig = z.infer<typeof rulesConfigSchema>;

export const DEFAULT_CONFIG: RulesConfig = {
  levels: {
    bronze: { minJobs: 3, minClients: 3 },
    silver: { minJobs: 5, minClients: 4, minEndorsements: 1, minAvgRating: 3.5, minRatings: 3, minMeetsReviews: 1 },
    gold: {
      minJobs: 12,
      minSpanDays: 90,
      minClients: 8,
      minEndorsingVerifiers: 2,
      minVerifiedUnitShare: 0.7,
      minMeetsReviews: 3,
    },
  },
  sampling: { firstJobsReviewed: 3, randomRate: 0.2, recentDisputeDays: 60, preLevelReview: true },
  competency: { pendingMinConfidence: 0.8, pendingMinJobs: 2 },
  endorsement: { minMeetsReviews: 3 },
  fraud: {
    sameClientMaxPerArtisan: 2,
    sameClientWindowDays: 30,
    ringMaxArtisans: 5,
    ringWindowDays: 30,
    phashMaxDistance: 10,
    captureDateMaxDaysBefore: 30,
    locationMaxKm: 15,
    recentRegistrationHours: 24,
    freezeIncidents: 2,
    freezeWindowDays: 90,
    verifierApprovalRateMax: 0.95,
    verifierApprovalMinReviews: 20,
  },
  confirmation: { reminderHours: [48, 120], expiryDays: 7 },
  clients: { blockAtReports: 2 },
  media: { maxBeforePhotos: 3, maxAfterPhotos: 5, maxVideoSeconds: 60, maxVoiceSeconds: 120, minQuality: 0.35 },
  trust: { weightQuality: 0.4, weightDisputes: 0.35, weightFlags: 0.25, priorQuality: 0.7 },
  workRequests: { followUpDays: 14, expiryDays: 7 },
};

export function parseConfig(input: unknown): RulesConfig {
  return rulesConfigSchema.parse(input);
}
