import type { Lang } from '../messages';
import { catalogue, type Entry, type MessageKey } from './catalogue';
import { webCatalogue, type WebKey } from './web';

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
  return interpolate(entry[lang] || entry.en, params);
}

/** Public web pages (passport, client rating page, landing page). */
export function tw(lang: Lang, key: WebKey, params?: Params): string {
  const entry: Entry = webCatalogue[key];
  return interpolate(entry[lang] || entry.en, params);
}

/** Every catalogue entry that still needs a native-speaker check. */
export function entriesNeedingReview(): { key: string; en: string; sn: string; nd: string }[] {
  return [...Object.entries(catalogue), ...Object.entries(webCatalogue)]
    .filter(([, e]) => (e as Entry).needsReview)
    .map(([key, e]) => ({ key, en: (e as Entry).en, sn: (e as Entry).sn, nd: (e as Entry).nd }));
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'sn' || v === 'nd';
}
