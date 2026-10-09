import type { Lang } from '../messages';
import { catalogue, type Entry, type MessageKey } from './catalogue';
import { webCatalogue, type WebKey } from './web';
import reviewed from './reviewed.json';

/** Native-speaker corrections imported with `pnpm --filter @sp/core translations import`. */
const REVIEWED = reviewed as Record<string, { sn: string; nd: string }>;

export { catalogue, webCatalogue };
export type { Entry, MessageKey, WebKey };

export type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Bot and notification messages. */
export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const entry: Entry = catalogue[key];
  const fix = lang !== 'en' ? REVIEWED[key]?.[lang] : undefined;
  return interpolate(fix || entry[lang] || entry.en, params);
}

/** Public web pages (passport, client rating page, landing page). */
export function tw(lang: Lang, key: WebKey, params?: Params): string {
  const entry: Entry = webCatalogue[key];
  const fix = lang !== 'en' ? REVIEWED[key]?.[lang] : undefined;
  return interpolate(fix || entry[lang] || entry.en, params);
}

/** Every catalogue entry that still needs a native-speaker check. */
export function entriesNeedingReview(): { key: string; en: string; sn: string; nd: string }[] {
  return [...Object.entries(catalogue), ...Object.entries(webCatalogue)]
    .filter(([key, e]) => (e as Entry).needsReview && !REVIEWED[key])
    .map(([key, e]) => ({ key, en: (e as Entry).en, sn: (e as Entry).sn, nd: (e as Entry).nd }));
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'sn' || v === 'nd';
}
