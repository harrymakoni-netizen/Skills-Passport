import { describe, expect, it } from 'vitest';
import {
  canTransition,
  IllegalTransitionError,
  isCountingStatus,
  JOB_STATUSES,
  jobCounts,
  nextStatuses,
  selectCountedJobs,
  transition,
  TRANSITIONS,
  type JobStatus,
} from '../src/jobs';
import { day } from './helpers';

describe('job state machine (SPEC 4.10)', () => {
  const allowed: [JobStatus, JobStatus][] = [
    ['draft', 'submitted'],
    ['submitted', 'awaiting_client'],
    ['awaiting_client', 'client_confirmed'],
    ['awaiting_client', 'client_disputed'],
    ['awaiting_client', 'client_expired'],
    ['client_expired', 'client_confirmed'],
    ['client_expired', 'closed'],
    ['client_confirmed', 'under_review'],
    ['client_disputed', 'under_review'],
    ['under_review', 'verified'],
    ['under_review', 'needs_improvement'],
    ['under_review', 'rejected'],
    ['client_confirmed', 'rejected'],
    ['verified', 'rejected'],
    ['needs_improvement', 'rejected'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(transition(from, to)).toBe(to);
  });

  const allowedSet = new Set(allowed.map(([a, b]) => `${a}>${b}`));
  const illegal = JOB_STATUSES.flatMap((from) => JOB_STATUSES.map((to) => [from, to] as [JobStatus, JobStatus])).filter(
    ([a, b]) => !allowedSet.has(`${a}>${b}`),
  );

  it.each(illegal)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => transition(from, to)).toThrow(IllegalTransitionError);
  });

  it('checks triggers', () => {
    expect(canTransition('awaiting_client', 'client_confirmed', 'client_confirmed')).toBe(true);
    expect(canTransition('awaiting_client', 'client_confirmed', 'review_decision')).toBe(false);
    expect(() => transition('awaiting_client', 'client_confirmed', 'review_decision')).toThrow(/review_decision/);
    expect(canTransition('client_confirmed', 'rejected', 'review_decision')).toBe(false);
    expect(canTransition('client_confirmed', 'rejected', 'admin_fraud_decision')).toBe(true);
  });

  it('lists next statuses', () => {
    expect(nextStatuses('awaiting_client').sort()).toEqual(['client_confirmed', 'client_disputed', 'client_expired']);
    expect(nextStatuses('closed')).toEqual([]);
    expect(nextStatuses('rejected')).toEqual([]);
  });

  it('every transition references known statuses', () => {
    for (const t of TRANSITIONS) {
      expect(JOB_STATUSES).toContain(t.from);
      expect(JOB_STATUSES).toContain(t.to);
    }
  });
});

describe('counting', () => {
  it.each([
    ['client_confirmed', true],
    ['verified', true],
    ['needs_improvement', true],
    ['rejected', false],
    ['client_disputed', false],
    ['client_expired', false],
    ['closed', false],
    ['awaiting_client', false],
    ['under_review', false],
    ['draft', false],
    ['submitted', false],
  ] as [JobStatus, boolean][])('%s counts: %s', (status, counts) => {
    expect(isCountingStatus(status)).toBe(counts);
  });

  it.each([
    ['routine review after client confirmation', { clientConfirmed: true, flagged: false, disputed: false }, true],
    ['flagged job under review', { clientConfirmed: true, flagged: true, disputed: false }, false],
    ['disputed job under review', { clientConfirmed: false, flagged: false, disputed: true }, false],
    ['under review without confirmation', { clientConfirmed: false, flagged: false, disputed: false }, false],
  ])('under_review counts only for %s (PLAN Q25)', (_n, p, expected) => {
    expect(jobCounts({ id: 'x', clientId: 'c', confirmedAt: day(1), status: 'under_review', ...p })).toBe(expected);
  });

  it('disputed jobs never count unless resolved for the artisan (PLAN Q3)', () => {
    const base = { id: 'a', clientId: 'c', confirmedAt: day(1), status: 'verified' as const };
    expect(jobCounts({ ...base, disputed: true })).toBe(false);
    expect(jobCounts({ ...base, disputed: true, disputeResolvedForArtisan: true })).toBe(true);
    expect(jobCounts({ ...base, disputed: false })).toBe(true);
  });
});

describe('selectCountedJobs — same-client cap (SPEC 6)', () => {
  const cap = { maxPerClient: 2, windowDays: 30 };
  const j = (id: string, clientId: string | null, d: number | null, status: JobStatus = 'client_confirmed') => ({
    id,
    clientId,
    confirmedAt: d === null ? null : day(d),
    disputed: false,
    status,
  });

  it('caps a client at 2 jobs in 30 days', () => {
    const counted = selectCountedJobs([j('a', 'x', 1), j('b', 'x', 2), j('c', 'x', 3), j('d', 'y', 3)], cap);
    expect([...counted].sort()).toEqual(['a', 'b', 'd']);
  });

  it('counts again once the window has rolled', () => {
    const counted = selectCountedJobs([j('a', 'x', 1), j('b', 'x', 2), j('c', 'x', 31), j('d', 'x', 33)], cap);
    expect([...counted].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a capped job does not consume the window', () => {
    // a(1), b(2) counted; c(20) capped; d(31) — window (1..31] has b only → counts.
    const counted = selectCountedJobs([j('a', 'x', 1), j('b', 'x', 2), j('c', 'x', 20), j('d', 'x', 31)], cap);
    expect([...counted].sort()).toEqual(['a', 'b', 'd']);
  });

  it('ignores non-counting jobs and counts jobs without client or confirmation time', () => {
    const counted = selectCountedJobs([j('a', 'x', 1, 'rejected'), j('b', null, null), j('c', 'x', null)], cap);
    expect([...counted].sort()).toEqual(['b', 'c']);
  });

  it('breaks ties by id deterministically', () => {
    const counted = selectCountedJobs([j('b', 'x', 1), j('a', 'x', 1), j('c', 'x', 1)], cap);
    expect([...counted].sort()).toEqual(['a', 'b']);
  });
});
