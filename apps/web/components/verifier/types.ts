export type QueueItem = {
  id: string;
  ref: string;
  artisan: { displayName: string; passportCode: string; level: string };
  trade: { en: string };
  jobType: { en: string };
  area: string | null;
  jobDate: string | null;
  queuedAt: string;
  reason: string | null;
  flags: string[];
  disputed: boolean;
  thumb: string | null;
};

export type Detail = {
  id: string;
  ref: string;
  status: string;
  artisan: { id: string; displayName: string; passportCode: string; level: string };
  trade: { en: string };
  jobType: { en: string };
  jobDate: string | null;
  area: string | null;
  agentAssisted: boolean;
  reviewReason: string | null;
  disputed: boolean;
  notes: string[];
  aiSummary: { summary: string; tasks: string[]; materials: string[]; safety_measures: string[]; model_version: string; prompt_version: string } | null;
  artisanSummary: { summary: string; source: string } | null;
  confirmation: { response: string | null; rating: number | null; comment: string | null; respondedAt: string | null; channel: string } | null;
  media: { id: string; kind: 'photo_before' | 'photo_after' | 'video' | 'voice'; url: string | null; thumb: string | null; durationSec: number | null; capturedAt: string | null; quality: number | null; duplicate: boolean; transcript: { text: string; confidence: number; language: string } | null }[];
  flags: { rule: string; severity: string; reason: string; status: string }[];
  units: { id: string; code: string; title: { en: string }; evidenceGuidance: string; aiConfidence: number | null; aiEvidence: string[]; verifierStatus: string | null }[];
  suggestedUnitIds: string[];
  endorsement: { eligible: true } | { eligible: false; reason: string; meetsByMe: number; needed: number };
};

export const REASON: Record<string, string> = {
  first_jobs: 'First jobs',
  random: 'Random sample',
  flagged: 'Flagged',
  disputed: 'Client disputed',
  recent_dispute: 'Recent dispute',
  pre_level: 'Before next level',
};
