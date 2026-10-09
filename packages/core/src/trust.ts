import type { RulesConfig } from './config';

export interface TrustInput {
  /** Jobs that reached the client (sent for confirmation). */
  jobsSent: number;
  disputedOrRejected: number;
  /** Jobs with at least one upheld fraud flag. */
  flaggedJobs: number;
  reviews: { meets: number; needsImprovement: number; reject: number };
}

/**
 * Internal trust score, 0–100, never shown publicly (SPEC 6).
 *
 *   quality     = (meets + 0.5 × needs_improvement) / reviews        (priorQuality when there are no reviews)
 *   disputeRate = disputed_or_rejected / jobs_sent                    (0 when nothing sent)
 *   flagRate    = flagged_jobs / jobs_sent                            (0 when nothing sent)
 *   trust       = 100 × (wQ × quality + wD × (1 − disputeRate) + wF × (1 − flagRate)) / (wQ + wD + wF)
 *
 * Weights come from config.trust. A new artisan therefore starts at about 88 with default weights,
 * and every dispute, upheld flag or poor review pulls the score down proportionally.
 */
export function trustScore(input: TrustInput, config: RulesConfig): number {
  const { weightQuality: wQ, weightDisputes: wD, weightFlags: wF, priorQuality } = config.trust;
  const reviews = input.reviews.meets + input.reviews.needsImprovement + input.reviews.reject;
  const quality = reviews ? (input.reviews.meets + 0.5 * input.reviews.needsImprovement) / reviews : priorQuality;
  const sent = Math.max(input.jobsSent, 0);
  const disputeRate = sent ? Math.min(input.disputedOrRejected / sent, 1) : 0;
  const flagRate = sent ? Math.min(input.flaggedJobs / sent, 1) : 0;
  const total = wQ + wD + wF;
  if (total <= 0) return 0;
  const score = (100 * (wQ * quality + wD * (1 - disputeRate) + wF * (1 - flagRate))) / total;
  return Math.max(0, Math.min(100, Math.round(score)));
}
