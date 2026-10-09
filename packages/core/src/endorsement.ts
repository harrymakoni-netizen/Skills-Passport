import type { RulesConfig } from './config';

export type EndorseRefusal = 'conflict' | 'not_enough_reviews' | 'already_endorsed' | 'wrong_trade';

/** SPEC 4.4: a verifier can endorse after reviewing ≥ N jobs by the artisan rated "meets standard". */
export function canEndorse(
  input: {
    meetsReviewsByThisVerifier: number;
    conflicted: boolean;
    alreadyEndorsedTrade: boolean;
    verifierCoversTrade: boolean;
  },
  config: RulesConfig,
): { ok: true } | { ok: false; reason: EndorseRefusal } {
  if (input.conflicted) return { ok: false, reason: 'conflict' };
  if (!input.verifierCoversTrade) return { ok: false, reason: 'wrong_trade' };
  if (input.alreadyEndorsedTrade) return { ok: false, reason: 'already_endorsed' };
  if (input.meetsReviewsByThisVerifier < config.endorsement.minMeetsReviews) {
    return { ok: false, reason: 'not_enough_reviews' };
  }
  return { ok: true };
}
