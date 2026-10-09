import type { RulesConfig } from '../config';
import type { Level } from '../levels';
import type { ChecklistItem } from '../levels';
import type { Lang, OutboundMessage } from '../messages';

export type Localized = Record<Lang, string>;

export interface ArtisanView {
  id: string;
  firstName: string;
  displayName: string;
  passportCode: string;
  lang: Lang;
  level: Level;
  status: 'onboarding' | 'active' | 'frozen' | 'deleted';
  showFullName: boolean;
  trades: { id: string; name: Localized }[];
  areaId: string;
  areaName: string;
  cityCode: string;
  phoneHash: string;
}

export interface NewArtisanInput {
  phone: string;
  lang: Lang;
  fullName: string;
  birthYear: number;
  tradeIds: string[];
  areaId: string;
  areaPending: boolean;
  experienceYears: number;
  howLearned: 'apprenticeship' | 'family' | 'self_taught' | 'college' | 'other';
  demographicsConsent: boolean;
  gender: 'woman' | 'man' | 'prefer_not' | null;
  disability: 'yes' | 'no' | 'prefer_not' | null;
  publicBadges: string[];
  profilePhoto: { providerMediaId: string; mimeType: string } | null;
  consentTextVersion: string;
}

export type ClientPhoneCheckResult = 'ok' | 'own' | 'registered' | 'blocked';

export interface SubmitJobInput {
  clientName: string;
  clientPhone: string;
  jobDate: string; // YYYY-MM-DD (Africa/Harare calendar date)
  areaId: string;
  location: { lat: number; lng: number } | null;
  amountCents: number | null;
  notes: string[];
}

export interface PassportStatusView {
  code: string;
  level: Level;
  frozen: boolean;
  countedJobs: number;
  distinctClients: number;
  averageRating: number | null;
  next: { level: Level; items: ChecklistItem[] } | null;
  link: string;
}

export interface WaitingJobView {
  jobId: string;
  ref: string;
  jobType: Localized;
  clientName: string;
  sentAt: Date | null;
  remindersSent: number;
}

export interface WorkRequestView {
  id: string;
  buyerName: string;
  area: string;
  dates: string;
  description: string;
}

export type ClientAction = 'yes' | 'no' | 'stop';
export type ClientActionResult =
  | { result: 'confirmed'; lang: Lang; link: string }
  | { result: 'disputed'; lang: Lang }
  | { result: 'stopped'; lang: Lang }
  | { result: 'already'; lang: Lang }
  | { result: 'expired'; lang: Lang }
  | { result: 'not_found' };

/**
 * Everything the flows need from the outside world. Implemented in apps/worker against Postgres, Redis and queues,
 * and in tests with an in-memory fake. The flows themselves never do I/O.
 */
export interface FlowPorts {
  now(): Date;
  config(): RulesConfig;
  publicBaseUrl(): string;
  consentAudioKey(lang: Lang): string;

  listTrades(): Promise<{ id: string; code: string; name: Localized }[]>;
  listCities(): Promise<{ cityCode: string; city: string }[]>;
  listAreas(cityCode: string): Promise<{ id: string; name: string }[]>;
  listJobTypes(tradeId: string): Promise<{ id: string; name: Localized; needsBeforePhoto: boolean }[]>;

  findArtisanByPhone(phone: string): Promise<ArtisanView | null>;
  createArtisan(input: NewArtisanInput): Promise<ArtisanView>;
  updateArtisan(artisanId: string, patch: { lang?: Lang; showFullName?: boolean }): Promise<void>;
  deleteArtisan(artisanId: string): Promise<void>;

  createDraftJob(input: { artisanId: string; tradeId: string; jobTypeId: string }): Promise<{ jobId: string }>;
  attachMedia(input: {
    jobId: string;
    kind: 'photo_before' | 'photo_after' | 'video' | 'voice';
    providerMediaId: string;
    mimeType: string;
    durationSec?: number;
  }): Promise<void>;
  checkClientPhone(input: { artisanId: string; phone: string }): Promise<ClientPhoneCheckResult>;
  submitJob(jobId: string, input: SubmitJobInput): Promise<{ ref: string }>;
  discardDraftJob(jobId: string): Promise<void>;

  getPassportStatus(artisanId: string): Promise<PassportStatusView>;
  listWaitingJobs(artisanId: string): Promise<WaitingJobView[]>;
  remindClient(jobId: string): Promise<'sent' | 'limit'>;
  changeClientPhone(jobId: string, phone: string): Promise<ClientPhoneCheckResult>;

  confirmSummary(jobId: string): Promise<{ ref: string } | null>;
  correctSummary(
    jobId: string,
    correction: { text: string } | { providerMediaId: string; mimeType: string },
  ): Promise<{ ref: string } | null>;

  clientRespond(input: { phone: string; confirmationId: string; action: ClientAction }): Promise<ClientActionResult>;
  confirmOwnership(input: { artisanId: string; jobId: string; mine: boolean }): Promise<{ ref: string } | null>;

  getShareAssets(artisanId: string): Promise<{ link: string; qrUrl: string; cardUrl: string; tradeName: Localized }>;

  listOpenWorkRequests(artisanId: string): Promise<WorkRequestView[]>;
  respondWorkRequest(input: {
    artisanId: string;
    requestId: string;
    accept: boolean;
  }): Promise<{ ok: true; contactName?: string; contactPhone?: string } | { ok: false }>;
  recordHireOutcome(input: { phone: string; requestId: string; happened: boolean }): Promise<{ canLog: boolean; buyerName: string } | null>;
  logHireAsJob(input: { artisanId: string; requestId: string }): Promise<{ ref: string } | null>;

  requestFieldAgent(artisanId: string): Promise<void>;
  listRecentClients(artisanId: string): Promise<{ id: string; name: string }[]>;
  reportClient(input: { artisanId: string; clientId: string; reason: string }): Promise<void>;
}

export type FlowName = 'onboarding' | 'log_job' | 'waiting' | 'help' | 'settings' | 'work_requests';

export interface Session {
  flow: FlowName | null;
  step: string;
  data: Record<string, unknown>;
  lang: Lang;
  /** A pending one-off answer that takes priority over the current flow (e.g. correcting an AI summary). */
  pending?: { kind: 'fix_summary'; jobId: string } | null;
  updatedAt: string;
}

export interface FlowResult {
  session: Session | null;
  out: OutboundMessage[];
}
