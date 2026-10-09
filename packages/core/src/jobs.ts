/** Job status machine — SPEC 4.10. */
export const JOB_STATUSES = [
  'draft',
  'submitted',
  'awaiting_client',
  'client_confirmed',
  'client_disputed',
  'client_expired',
  'under_review',
  'verified',
  'needs_improvement',
  'rejected',
  'closed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type TransitionTrigger =
  | 'artisan_submitted'
  | 'confirmation_sent'
  | 'client_confirmed'
  | 'client_disputed'
  | 'client_no_answer'
  | 'agent_follow_up'
  | 'selected_for_review'
  | 'review_decision'
  | 'admin_fraud_decision';

interface Transition {
  from: JobStatus;
  to: JobStatus;
  triggers: TransitionTrigger[];
}

export const TRANSITIONS: readonly Transition[] = [
  { from: 'draft', to: 'submitted', triggers: ['artisan_submitted'] },
  { from: 'submitted', to: 'awaiting_client', triggers: ['confirmation_sent'] },
  { from: 'awaiting_client', to: 'client_confirmed', triggers: ['client_confirmed', 'agent_follow_up'] },
  { from: 'awaiting_client', to: 'client_disputed', triggers: ['client_disputed', 'agent_follow_up'] },
  { from: 'awaiting_client', to: 'client_expired', triggers: ['client_no_answer'] },
  { from: 'client_expired', to: 'client_confirmed', triggers: ['agent_follow_up'] },
  { from: 'client_expired', to: 'closed', triggers: ['agent_follow_up'] },
  { from: 'client_confirmed', to: 'under_review', triggers: ['selected_for_review'] },
  { from: 'client_disputed', to: 'under_review', triggers: ['selected_for_review'] },
  { from: 'under_review', to: 'verified', triggers: ['review_decision', 'admin_fraud_decision'] },
  { from: 'under_review', to: 'needs_improvement', triggers: ['review_decision', 'admin_fraud_decision'] },
  { from: 'under_review', to: 'rejected', triggers: ['review_decision', 'admin_fraud_decision'] },
  // Fraud review can reject a job at any point after the client answered (SPEC 5: "jobs rejected after a fraud review").
  { from: 'client_confirmed', to: 'rejected', triggers: ['admin_fraud_decision'] },
  { from: 'verified', to: 'rejected', triggers: ['admin_fraud_decision'] },
  { from: 'needs_improvement', to: 'rejected', triggers: ['admin_fraud_decision'] },
];

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: JobStatus,
    public readonly to: JobStatus,
    public readonly trigger?: TransitionTrigger,
  ) {
    super(`Illegal job transition ${from} -> ${to}${trigger ? ` (${trigger})` : ''}`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: JobStatus, to: JobStatus, trigger?: TransitionTrigger): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && (!trigger || t.triggers.includes(trigger)));
}

/** Returns the target status or throws `IllegalTransitionError`. */
export function transition(from: JobStatus, to: JobStatus, trigger?: TransitionTrigger): JobStatus {
  if (!canTransition(from, to, trigger)) throw new IllegalTransitionError(from, to, trigger);
  return to;
}

export function nextStatuses(from: JobStatus): JobStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

const COUNTING: ReadonlySet<JobStatus> = new Set(['client_confirmed', 'verified', 'needs_improvement']);

/** SPEC 4.10: statuses that can count toward the passport. */
export function isCountingStatus(status: JobStatus): boolean {
  return COUNTING.has(status);
}

export interface CountableJob {
  id: string;
  status: JobStatus;
  clientId: string | null;
  /** When the client confirmed (or the agent recorded a confirmation). */
  confirmedAt: Date | null;
  /** True if the client ever disputed this job. */
  disputed: boolean;
  /** Admin resolved the dispute in the artisan's favour (PLAN Q3). */
  disputeResolvedForArtisan?: boolean;
  /** The client confirmed this job (needed to count a job while it waits for routine review). */
  clientConfirmed?: boolean;
  /** The job has an open fraud flag. */
  flagged?: boolean;
}

/**
 * A single job counts when its status counts and it was never disputed (unless an admin resolved the dispute
 * for the artisan). This does not apply the same-client cap; see `selectCountedJobs`.
 */
export function jobCounts(job: CountableJob): boolean {
  if (job.disputed && !job.disputeResolvedForArtisan) return false;
  // PLAN Q25: a client-confirmed job picked by routine sampling keeps counting while it waits for review; a flagged
  // or disputed job does not count until a reviewer decides.
  if (job.status === 'under_review') return Boolean(job.clientConfirmed) && !job.flagged;
  return isCountingStatus(job.status);
}

/**
 * Applies `jobCounts` plus the fraud rule "same client confirms more than N jobs for the same artisan in D days —
 * only N count" (SPEC 6). Windows are rolling on confirmation time. Returns the ids of counted jobs.
 */
export function selectCountedJobs(
  jobs: readonly CountableJob[],
  cap: { maxPerClient: number; windowDays: number },
): Set<string> {
  const counted = new Set<string>();
  const byClient = new Map<string, CountableJob[]>();
  for (const job of jobs) {
    if (!jobCounts(job)) continue;
    if (!job.clientId || !job.confirmedAt) {
      counted.add(job.id);
      continue;
    }
    const list = byClient.get(job.clientId) ?? [];
    list.push(job);
    byClient.set(job.clientId, list);
  }
  const windowMs = cap.windowDays * 24 * 60 * 60 * 1000;
  for (const list of byClient.values()) {
    list.sort((a, b) => a.confirmedAt!.getTime() - b.confirmedAt!.getTime() || a.id.localeCompare(b.id));
    const kept: Date[] = [];
    for (const job of list) {
      const t = job.confirmedAt!.getTime();
      const inWindow = kept.filter((k) => t - k.getTime() < windowMs).length;
      if (inWindow < cap.maxPerClient) {
        kept.push(job.confirmedAt!);
        counted.add(job.id);
      }
    }
  }
  return counted;
}
