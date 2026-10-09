import type { RulesConfig } from './config';
import { DAY_MS, HOUR_MS, withinDays } from './time';

/**
 * SPEC 6 fraud rules. Each rule is a pure function that returns a `FraudFlag` or `null`.
 * `action: 'block'` stops the input (no flag row is stored); `freeze` freezes level changes.
 */
export type FraudRuleId =
  | 'FR01_client_is_registered_phone'
  | 'FR02_same_client_repeat'
  | 'FR03_confirmation_ring'
  | 'FR04_duplicate_image'
  | 'FR05_old_capture_date'
  | 'FR06_suspect_image'
  | 'FR07_location_mismatch'
  | 'FR08_recently_registered_client'
  | 'FR09_repeated_incidents'
  | 'FR10_verifier_conflict'
  | 'FR11_verifier_approval_rate';

export type FraudSeverity = 'soft' | 'standard' | 'high';
export type FraudAction = 'block' | 'flag' | 'freeze';
export type FraudEntity = 'job' | 'client' | 'verifier' | 'artisan';

export interface FraudFlag {
  rule: FraudRuleId;
  entity: FraudEntity;
  severity: FraudSeverity;
  action: FraudAction;
  /** Plain-language reason shown to admins (never to the public). */
  reason: string;
  evidence?: Record<string, unknown>;
}

// ---------------------------------------------------------------- FR01

export interface ClientPhoneCheck {
  clientPhoneHash: string;
  artisanPhoneHash: string;
  /** True if the hash belongs to any registered artisan or verifier (lookup done by the caller). */
  belongsToRegisteredArtisanOrVerifier: boolean;
}

/** Client phone equals the artisan's phone, or any registered artisan's or verifier's phone → block. */
export function checkClientIsRegisteredPhone(input: ClientPhoneCheck): FraudFlag | null {
  const own = input.clientPhoneHash === input.artisanPhoneHash;
  if (!own && !input.belongsToRegisteredArtisanOrVerifier) return null;
  return {
    rule: 'FR01_client_is_registered_phone',
    entity: 'job',
    severity: 'high',
    action: 'block',
    reason: own ? 'Client phone is the artisan’s own number' : 'Client phone belongs to a registered artisan or verifier',
  };
}

// ---------------------------------------------------------------- FR02

export interface SameClientRepeatInput {
  /** Confirmation times of earlier jobs from this client for this artisan. */
  priorConfirmations: readonly Date[];
  now: Date;
}

/** Same client confirms more than N jobs for the same artisan in D days → flag (only N count; see selectCountedJobs). */
export function checkSameClientRepeat(input: SameClientRepeatInput, config: RulesConfig): FraudFlag | null {
  const { sameClientMaxPerArtisan: max, sameClientWindowDays: days } = config.fraud;
  const recent = input.priorConfirmations.filter((d) => withinDays(d, input.now, days)).length;
  if (recent + 1 <= max) return null;
  return {
    rule: 'FR02_same_client_repeat',
    entity: 'job',
    severity: 'standard',
    action: 'flag',
    reason: `Same client has confirmed ${recent + 1} jobs for this artisan in ${days} days; only ${max} count`,
    evidence: { confirmationsInWindow: recent + 1 },
  };
}

// ---------------------------------------------------------------- FR03

export interface ConfirmationRingInput {
  /** Artisan ids this client confirmed jobs for, with confirmation times (including the current one). */
  confirmations: readonly { artisanId: string; at: Date }[];
  now: Date;
}

/** One client phone confirms jobs for more than N different artisans in D days → flag all (possible ring). */
export function checkConfirmationRing(input: ConfirmationRingInput, config: RulesConfig): FraudFlag | null {
  const { ringMaxArtisans: max, ringWindowDays: days } = config.fraud;
  const artisans = new Set(input.confirmations.filter((c) => withinDays(c.at, input.now, days)).map((c) => c.artisanId));
  if (artisans.size <= max) return null;
  return {
    rule: 'FR03_confirmation_ring',
    entity: 'client',
    severity: 'high',
    action: 'flag',
    reason: `Client confirmed jobs for ${artisans.size} different artisans in ${days} days`,
    evidence: { artisans: artisans.size },
  };
}

// ---------------------------------------------------------------- FR04

/** Hamming distance between two 64-bit hashes given as 16-char hex strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('Hash length mismatch');
  let dist = 0;
  for (let i = 0; i < a.length; i += 8) {
    let x = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0;
    while (x) {
      dist += x & 1;
      x >>>= 1;
    }
  }
  return dist;
}

export interface DuplicateImageInput {
  phash: string;
  candidates: readonly { mediaId: string; jobId: string; phash: string }[];
}

/** Duplicate or near-duplicate image across any jobs → flag; the duplicate photo is excluded. */
export function checkDuplicateImage(input: DuplicateImageInput, config: RulesConfig): FraudFlag | null {
  const matches = input.candidates
    .map((c) => ({ ...c, distance: hammingDistance(input.phash, c.phash) }))
    .filter((c) => c.distance < config.fraud.phashMaxDistance)
    .sort((a, b) => a.distance - b.distance);
  if (matches.length === 0) return null;
  return {
    rule: 'FR04_duplicate_image',
    entity: 'job',
    severity: 'standard',
    action: 'flag',
    reason: `Photo matches ${matches.length} earlier photo(s)`,
    evidence: { matches: matches.slice(0, 5).map(({ mediaId, jobId, distance }) => ({ mediaId, jobId, distance })) },
  };
}

// ---------------------------------------------------------------- FR05

/** Photo metadata shows a capture date long before the job date → soft flag. */
export function checkCaptureDate(
  input: { capturedAt: Date | null; jobDate: Date },
  config: RulesConfig,
): FraudFlag | null {
  if (!input.capturedAt) return null;
  const limit = input.jobDate.getTime() - config.fraud.captureDateMaxDaysBefore * DAY_MS;
  if (input.capturedAt.getTime() >= limit) return null;
  const days = Math.floor((input.jobDate.getTime() - input.capturedAt.getTime()) / DAY_MS);
  return {
    rule: 'FR05_old_capture_date',
    entity: 'job',
    severity: 'soft',
    action: 'flag',
    reason: `Photo was taken ${days} days before the job date`,
    evidence: { days },
  };
}

// ---------------------------------------------------------------- FR06

export interface ImageChecks {
  quality_ok: boolean;
  looks_like_trade_work: boolean;
  possible_stock_or_screenshot: boolean;
}

/** Image looks like a screenshot, stock photo or downloaded image (AI check) → flag. Never auto-reject. */
export function checkSuspectImage(checks: ImageChecks | null): FraudFlag | null {
  if (!checks) return null;
  if (!checks.possible_stock_or_screenshot && checks.looks_like_trade_work) return null;
  return {
    rule: 'FR06_suspect_image',
    entity: 'job',
    severity: 'standard',
    action: 'flag',
    reason: checks.possible_stock_or_screenshot
      ? 'Photo may be a screenshot, stock or downloaded image'
      : 'Photo does not look like work in this trade',
  };
}

// ---------------------------------------------------------------- FR07

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Shared location far from the stated job area → soft flag. */
export function checkLocation(
  input: { shared: { lat: number; lng: number } | null; area: { lat: number; lng: number } | null },
  config: RulesConfig,
): FraudFlag | null {
  if (!input.shared || !input.area) return null;
  const km = haversineKm(input.shared, input.area);
  if (km <= config.fraud.locationMaxKm) return null;
  return {
    rule: 'FR07_location_mismatch',
    entity: 'job',
    severity: 'soft',
    action: 'flag',
    reason: `Shared location is ${Math.round(km)} km from the stated area`,
    evidence: { km: Math.round(km) },
  };
}

// ---------------------------------------------------------------- FR08

export interface RecentRegistrationInput {
  /** When this client phone was first seen on the platform. */
  clientFirstSeenAt: Date;
  /** True if the client was first seen on a job for a different artisan. */
  firstSeenForOtherArtisan: boolean;
  /** If the phone was registered as an artisan or staff member, when. */
  registeredAsUserAt: Date | null;
  /** When the current job was submitted. */
  jobSubmittedAt: Date;
}

/**
 * Confirmation from a phone number registered in the last 24 hours → soft flag (PLAN Q12): the client phone first
 * appeared less than 24 h before this job was submitted on another artisan's job, or registered as a user in that window.
 */
export function checkRecentlyRegisteredClient(input: RecentRegistrationInput, config: RulesConfig): FraudFlag | null {
  const windowMs = config.fraud.recentRegistrationHours * HOUR_MS;
  const submitted = input.jobSubmittedAt.getTime();
  const recentOther =
    input.firstSeenForOtherArtisan &&
    submitted - input.clientFirstSeenAt.getTime() < windowMs &&
    submitted >= input.clientFirstSeenAt.getTime();
  const recentUser =
    input.registeredAsUserAt !== null &&
    Math.abs(submitted - input.registeredAsUserAt.getTime()) < windowMs;
  if (!recentOther && !recentUser) return null;
  return {
    rule: 'FR08_recently_registered_client',
    entity: 'job',
    severity: 'soft',
    action: 'flag',
    reason: 'Client phone was first registered on the platform less than 24 hours before this job',
  };
}

// ---------------------------------------------------------------- FR09

/** 2 or more disputed or rejected jobs in 90 days → freeze level changes; admin review. */
export function checkRepeatedIncidents(
  input: { incidents: readonly Date[]; now: Date },
  config: RulesConfig,
): FraudFlag | null {
  const { freezeIncidents: n, freezeWindowDays: days } = config.fraud;
  const recent = input.incidents.filter((d) => withinDays(d, input.now, days)).length;
  if (recent < n) return null;
  return {
    rule: 'FR09_repeated_incidents',
    entity: 'artisan',
    severity: 'high',
    action: 'freeze',
    reason: `${recent} disputed or rejected jobs in ${days} days — level changes frozen for review`,
    evidence: { incidents: recent },
  };
}

// ---------------------------------------------------------------- FR10 / FR11

/** Verifier reviews or endorses an artisan they declared a conflict with → flag verifier (and the action is refused). */
export function checkVerifierConflict(input: { conflictedArtisanIds: readonly string[]; artisanId: string }): FraudFlag | null {
  if (!input.conflictedArtisanIds.includes(input.artisanId)) return null;
  return {
    rule: 'FR10_verifier_conflict',
    entity: 'verifier',
    severity: 'high',
    action: 'block',
    reason: 'Verifier declared a conflict of interest with this artisan',
  };
}

/** Verifier approves at an unusually high rate → flag verifier for admin review. */
export function checkVerifierApprovalRate(
  input: { reviews: number; meets: number },
  config: RulesConfig,
): FraudFlag | null {
  if (input.reviews < config.fraud.verifierApprovalMinReviews) return null;
  const rate = input.meets / input.reviews;
  if (rate <= config.fraud.verifierApprovalRateMax) return null;
  return {
    rule: 'FR11_verifier_approval_rate',
    entity: 'verifier',
    severity: 'standard',
    action: 'flag',
    reason: `Verifier rated ${Math.round(rate * 100)}% of ${input.reviews} reviews as meets standard`,
    evidence: { rate },
  };
}
