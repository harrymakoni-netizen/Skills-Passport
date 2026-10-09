export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / DAY_MS;
}

export function withinDays(at: Date, now: Date, days: number): boolean {
  const diff = now.getTime() - at.getTime();
  return diff >= 0 && diff <= days * DAY_MS;
}

const HARARE = 'Africa/Harare';

/** Formats a UTC instant for display in Zimbabwe, e.g. "12 Nov 2026". */
export function formatDateHarare(d: Date, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: HARARE }).format(d);
}

/** Short form used in WhatsApp messages, e.g. "12 Nov". */
export function formatDayMonthHarare(d: Date, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: HARARE }).format(d);
}

/** Calendar date (YYYY-MM-DD) in Africa/Harare for a UTC instant. */
export function harareDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: HARARE }).format(d);
  return parts;
}
