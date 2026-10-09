import type { Lang } from '@sp/core';

export type Localized = Record<Lang, string>;
export type Level = 'starter' | 'bronze' | 'silver' | 'gold';

export interface PublicPassport {
  code: string;
  displayName: string;
  firstName: string;
  trades: { id: string; code: string; name: Localized }[];
  area: string;
  city: string;
  level: Level;
  memberSince: string;
  experienceYears: number | null;
  badges: string[];
  profilePhotoUrl: string | null;
  stats: { countedJobs: number; distinctClients: number; averageRating: number | null; ratingsCount: number; reviewedJobs: number };
  gallery: { id: string; url: string; thumb: string; width: number | null; height: number | null; jobType: Localized; month: string; reviewed: boolean }[];
  competencies: { tradeId: string; tradeName: Localized; verified: number; total: number; units: { code: string; title: Localized; status: 'verified' | 'pending' | 'none' }[] }[];
  endorsements: { id: string; verifierName: string; yearsExperience: number; tradeName: Localized; statement: string; date: string }[];
  url: string;
}
