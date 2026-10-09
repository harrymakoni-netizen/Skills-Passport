import { DEFAULT_CONFIG, type RulesConfig } from '../src/config';
import type { LevelJob } from '../src/levels';

export const cfg = (patch: (c: RulesConfig) => void = () => {}): RulesConfig => {
  const c = structuredClone(DEFAULT_CONFIG);
  patch(c);
  return c;
};

export const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86400000);

let seq = 0;
export function job(p: Partial<LevelJob> = {}): LevelJob {
  seq += 1;
  return {
    id: p.id ?? `j${seq}`,
    status: p.status ?? 'client_confirmed',
    clientId: p.clientId === undefined ? `c${seq}` : p.clientId,
    confirmedAt: p.confirmedAt === undefined ? day(seq) : p.confirmedAt,
    disputed: p.disputed ?? false,
    disputeResolvedForArtisan: p.disputeResolvedForArtisan ?? false,
    jobDate: p.jobDate ?? day(seq),
    rating: p.rating === undefined ? null : p.rating,
    reviewQuality: p.reviewQuality === undefined ? null : p.reviewQuality,
  };
}
