import type { RulesConfig } from './config';
import { type JobStatus } from './jobs';

export type CompetencyStatus = 'verified' | 'pending' | 'none';

export interface CompetencyEvidence {
  jobId: string;
  unitId: string;
  source: 'ai' | 'verifier';
  confidence: number | null;
  status: 'suggested' | 'confirmed' | 'removed';
}

export interface CompetencyJob {
  id: string;
  status: JobStatus;
  /** Result of selectCountedJobs / jobCounts. */
  counted: boolean;
}

/**
 * SPEC 5 competency status.
 * - verified: confirmed by a verifier on at least one job that was not rejected;
 * - pending: AI-suggested with confidence ≥ threshold on ≥ N counted jobs, not removed by a verifier on that job;
 * - none: otherwise.
 */
export function competencyStatuses(
  unitIds: readonly string[],
  evidence: readonly CompetencyEvidence[],
  jobs: readonly CompetencyJob[],
  config: RulesConfig,
): Map<string, CompetencyStatus> {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const removed = new Set(
    evidence.filter((e) => e.status === 'removed').map((e) => `${e.jobId}:${e.unitId}`),
  );
  const result = new Map<string, CompetencyStatus>();
  for (const unitId of unitIds) {
    const forUnit = evidence.filter((e) => e.unitId === unitId);
    const verified = forUnit.some((e) => {
      const job = jobById.get(e.jobId);
      return e.status === 'confirmed' && job !== undefined && job.status !== 'rejected';
    });
    if (verified) {
      result.set(unitId, 'verified');
      continue;
    }
    const pendingJobs = new Set(
      forUnit
        .filter(
          (e) =>
            e.source === 'ai' &&
            e.status === 'suggested' &&
            (e.confidence ?? 0) >= config.competency.pendingMinConfidence &&
            jobById.get(e.jobId)?.counted === true &&
            !removed.has(`${e.jobId}:${e.unitId}`),
        )
        .map((e) => e.jobId),
    );
    result.set(unitId, pendingJobs.size >= config.competency.pendingMinJobs ? 'pending' : 'none');
  }
  return result;
}
