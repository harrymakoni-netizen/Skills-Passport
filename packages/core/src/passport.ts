/** Passport codes: SP-{CITY}-{00000}, sequence per city (PLAN Q8). */
export function formatPassportCode(cityCode: string, n: number): string {
  if (!/^[A-Z]{3}$/.test(cityCode)) throw new Error(`Invalid city code ${cityCode}`);
  if (!Number.isInteger(n) || n < 1 || n > 99999) throw new Error(`Passport number out of range: ${n}`);
  return `SP-${cityCode}-${String(n).padStart(5, '0')}`;
}

export const PASSPORT_CODE_RE = /^SP-[A-Z]{3}-\d{5}$/;

export function isPassportCode(code: string): boolean {
  return PASSPORT_CODE_RE.test(code);
}

/** Public display name: first name + surname initial, unless the artisan chose to show their full name. */
export function publicDisplayName(fullName: string, showFullName: boolean): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (showFullName || parts.length === 1) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** Age at a date from birth year and month (1–12). */
export function ageAt(birthYear: number, birthMonth: number, at: Date): number {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth() + 1;
  return y - birthYear - (m < birthMonth ? 1 : 0);
}

/** Possible ages from birth year alone: [min, max]. */
export function ageRangeFromYear(birthYear: number, at: Date): [number, number] {
  const y = at.getUTCFullYear();
  return [y - birthYear - 1, y - birthYear];
}

export const MIN_AGE = 18;
export const MAX_AGE = 35;

/** Short job reference, e.g. "J-7K3Q2" (no 0/O/1/I to avoid confusion when read aloud). */
export function makeJobRef(random: () => number): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(random() * alphabet.length)];
  return `J-${s}`;
}
