/**
 * Phone helpers. Numbers are normalised to E.164. Zimbabwe local formats (07x…, 7x…, 2637x…) are converted;
 * other numbers must already start with "+" and a country code.
 */
export function normalisePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s\-().]/g, '');
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith('+')) digits = raw.slice(1);
  else if (raw.startsWith('00')) digits = raw.slice(2);
  else if (raw.startsWith('0')) digits = `263${raw.slice(1)}`;
  else if (raw.startsWith('263')) digits = raw;
  else if (/^7\d{8}$/.test(raw)) digits = `263${raw}`;
  else return null;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('263')) {
    // Zimbabwe mobile: +263 7X XXX XXXX (9 digits after the country code); landlines are not accepted for WhatsApp.
    return /^2637[1-9]\d{7}$/.test(digits) ? `+${digits}` : null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** Masks a phone for display to staff, e.g. "+263 77 *** 0123". Never use on public pages. */
export function maskPhone(e164: string): string {
  const d = e164.replace(/^\+/, '');
  if (d.startsWith('263') && d.length === 12) return `+263 ${d.slice(3, 5)} *** ${d.slice(8)}`;
  return `+${d.slice(0, 3)} *** ${d.slice(-4)}`;
}

/** Fictional test/seed range required by CLAUDE.md: +26377000xxxx. */
export function isFictionalTestPhone(e164: string): boolean {
  return /^\+26377000\d{4}$/.test(e164);
}
