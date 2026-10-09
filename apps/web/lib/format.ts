const HARARE = 'Africa/Harare';

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: HARARE }).format(new Date(iso));
}
export function fmtMonth(iso: string) {
  return fmtDate(iso, { month: 'short', year: 'numeric' });
}
export function fmtDateTime(iso: string | Date) {
  return fmtDate(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
/** "3 h", "2 d" — age in the review queue. */
export function age(iso: string, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
