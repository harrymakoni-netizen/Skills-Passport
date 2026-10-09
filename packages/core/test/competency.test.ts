import { describe, expect, it } from 'vitest';
import { competencyStatuses, type CompetencyEvidence, type CompetencyJob } from '../src/competency';
import { canEndorse } from '../src/endorsement';
import { cfg } from './helpers';

const jobs: CompetencyJob[] = [
  { id: 'j1', status: 'client_confirmed', counted: true },
  { id: 'j2', status: 'verified', counted: true },
  { id: 'j3', status: 'rejected', counted: false },
  { id: 'j4', status: 'awaiting_client', counted: false },
];
const ai = (jobId: string, unitId: string, confidence: number | null, status: CompetencyEvidence['status'] = 'suggested'): CompetencyEvidence => ({ jobId, unitId, source: 'ai', confidence, status });
const ver = (jobId: string, unitId: string, status: CompetencyEvidence['status'] = 'confirmed'): CompetencyEvidence => ({ jobId, unitId, source: 'verifier', confidence: null, status });

describe('competency status (SPEC 5)', () => {
  const c = cfg();
  const run = (ev: CompetencyEvidence[]) => competencyStatuses(['U'], ev, jobs, c).get('U');

  it.each([
    ['nothing', [], 'none'],
    ['verifier confirmed on one job', [ver('j1', 'U')], 'verified'],
    ['verifier confirmed on a rejected job', [ver('j3', 'U')], 'none'],
    ['verifier confirmed on unknown job', [ver('jx', 'U')], 'none'],
    ['AI ≥0.80 on 2 counted jobs', [ai('j1', 'U', 0.8), ai('j2', 'U', 0.95)], 'pending'],
    ['AI ≥0.80 on 1 counted job', [ai('j1', 'U', 0.9)], 'none'],
    ['AI ≥0.80 twice on the same job', [ai('j1', 'U', 0.9), ai('j1', 'U', 0.85)], 'none'],
    ['AI 0.79 on one job', [ai('j1', 'U', 0.79), ai('j2', 'U', 0.9)], 'none'],
    ['AI null confidence', [ai('j1', 'U', null), ai('j2', 'U', 0.9)], 'none'],
    ['AI on uncounted job', [ai('j1', 'U', 0.9), ai('j4', 'U', 0.9)], 'none'],
    ['AI removed by verifier on one job', [ai('j1', 'U', 0.9), ai('j2', 'U', 0.9), ver('j2', 'U', 'removed')], 'none'],
    ['AI suggestion marked removed', [ai('j1', 'U', 0.9), ai('j2', 'U', 0.9, 'removed')], 'none'],
    ['verified beats pending', [ai('j1', 'U', 0.9), ai('j2', 'U', 0.9), ver('j1', 'U')], 'verified'],
  ] as [string, CompetencyEvidence[], string][])('%s → %s', (_n, ev, expected) => {
    expect(run(ev)).toBe(expected);
  });

  it('only reports requested units', () => {
    const m = competencyStatuses(['A', 'B'], [ver('j1', 'A'), ver('j1', 'C')], jobs, c);
    expect([...m.entries()]).toEqual([
      ['A', 'verified'],
      ['B', 'none'],
    ]);
  });
});

describe('endorsement eligibility (SPEC 4.4)', () => {
  const c = cfg();
  const ok = { meetsReviewsByThisVerifier: 3, conflicted: false, alreadyEndorsedTrade: false, verifierCoversTrade: true };
  it.each([
    ['eligible', ok, { ok: true }],
    ['conflict', { ...ok, conflicted: true }, { ok: false, reason: 'conflict' }],
    ['wrong trade', { ...ok, verifierCoversTrade: false }, { ok: false, reason: 'wrong_trade' }],
    ['already endorsed', { ...ok, alreadyEndorsedTrade: true }, { ok: false, reason: 'already_endorsed' }],
    ['2 reviews', { ...ok, meetsReviewsByThisVerifier: 2 }, { ok: false, reason: 'not_enough_reviews' }],
  ])('%s', (_n, input, expected) => {
    expect(canEndorse(input, c)).toEqual(expected);
  });
});
