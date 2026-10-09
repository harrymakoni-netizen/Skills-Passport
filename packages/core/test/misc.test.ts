import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from '../src/config';
import { catalogue, entriesNeedingReview, isLang, t, tw, webCatalogue } from '../src/i18n';
import { clip } from '../src/messages';
import { ageAt, ageRangeFromYear, formatPassportCode, isPassportCode, makeJobRef, publicDisplayName } from '../src/passport';
import { isFictionalTestPhone, maskPhone, normalisePhone } from '../src/phone';
import { seededRandom } from '../src/sampling';
import { TEMPLATES } from '../src/templates';
import { daysBetween, formatDateHarare, formatDayMonthHarare, harareDateKey, withinDays } from '../src/time';

describe('i18n catalogue', () => {
  it('every key has en, sn and nd', () => {
    for (const [key, e] of [...Object.entries(catalogue), ...Object.entries(webCatalogue)]) {
      for (const lang of ['en', 'sn', 'nd'] as const) {
        expect(e[lang], `${key}.${lang}`).toBeTruthy();
      }
    }
  });
  it('placeholders match across languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, e] of [...Object.entries(catalogue), ...Object.entries(webCatalogue)]) {
      expect(ph(e.sn), key).toBe(ph(e.en));
      expect(ph(e.nd), key).toBe(ph(e.en));
    }
  });
  it('interpolates and leaves unknown placeholders', () => {
    expect(t('en', 'menu.body', { name: 'Tendai' })).toBe('Hi Tendai. What would you like to do?');
    expect(t('sn', 'menu.body')).toContain('{name}');
    expect(tw('nd', 'p.units_verified', { n: 2, total: 8 })).toContain('2');
  });
  it('drafts are marked for review', () => {
    expect(entriesNeedingReview().length).toBeGreaterThan(100);
    expect(isLang('sn')).toBe(true);
    expect(isLang('fr')).toBe(false);
  });
  it('every template body and button exists in the catalogue', () => {
    for (const tpl of Object.values(TEMPLATES)) {
      expect(catalogue).toHaveProperty(tpl.bodyKey);
      for (const b of tpl.buttons) expect(catalogue).toHaveProperty(b.titleKey);
      for (const lang of tpl.languages) {
        const body = (catalogue as Record<string, { en: string }>)[tpl.bodyKey]!.en;
        expect(body.match(/\{\d\}/g)?.length, `${tpl.name} ${lang}`).toBe(tpl.params.length);
      }
    }
  });
  it('the catalogue has no exclamation marks in English', () => {
    for (const [key, e] of [...Object.entries(catalogue), ...Object.entries(webCatalogue)]) expect(e.en, key).not.toMatch(/!/);
  });
});

describe('phone', () => {
  it.each([
    ['0771234567', '+263771234567'],
    ['077 123 4567', '+263771234567'],
    ['+263 77 123 4567', '+263771234567'],
    ['263771234567', '+263771234567'],
    ['00263771234567', '+263771234567'],
    ['771234567', '+263771234567'],
    ['(077) 123-4567', '+263771234567'],
    ['+27821234567', '+27821234567'],
    ['0242123456', null],
    ['12345', null],
    ['', null],
    ['+abc', null],
    ['+1234567', null],
  ])('%s → %s', (input, out) => {
    expect(normalisePhone(input)).toBe(out);
  });
  it('masks', () => {
    expect(maskPhone('+263770001234')).toBe('+263 77 *** 1234');
    expect(maskPhone('+27821234567')).toBe('+278 *** 4567');
  });
  it('fictional range', () => {
    expect(isFictionalTestPhone('+263770001234')).toBe(true);
    expect(isFictionalTestPhone('+263771234567')).toBe(false);
  });
});

describe('passport helpers', () => {
  it('formats codes', () => {
    expect(formatPassportCode('HRE', 123)).toBe('SP-HRE-00123');
    expect(isPassportCode('SP-HRE-00123')).toBe(true);
    expect(isPassportCode('SP-HR-00123')).toBe(false);
    expect(() => formatPassportCode('hre', 1)).toThrow();
    expect(() => formatPassportCode('HRE', 0)).toThrow();
    expect(() => formatPassportCode('HRE', 100000)).toThrow();
  });
  it.each([
    ['Tendai Moyo', false, 'Tendai M.'],
    ['Tendai Moyo', true, 'Tendai Moyo'],
    ['Rudo Chipo Ncube', false, 'Rudo N.'],
    ['Tendai', false, 'Tendai'],
    ['  ', false, ''],
  ])('display name %s', (name, full, out) => {
    expect(publicDisplayName(name, full)).toBe(out);
  });
  it('ages', () => {
    const at = new Date(Date.UTC(2026, 9, 9));
    expect(ageAt(2008, 10, at)).toBe(18);
    expect(ageAt(2008, 11, at)).toBe(17);
    expect(ageRangeFromYear(1991, at)).toEqual([34, 35]);
  });
  it('job refs avoid confusing characters', () => {
    const ref = makeJobRef(seededRandom(1));
    expect(ref).toMatch(/^J-[2-9A-HJ-NP-Z]{5}$/);
  });
});

describe('config and time', () => {
  it('defaults validate', () => {
    expect(parseConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
    expect(() => parseConfig({})).toThrow();
  });
  it('time helpers', () => {
    const a = new Date('2026-11-12T22:30:00Z');
    expect(harareDateKey(a)).toBe('2026-11-13');
    expect(formatDayMonthHarare(a)).toBe('13 Nov');
    expect(formatDateHarare(a)).toBe('13 Nov 2026');
    expect(daysBetween(a, new Date(a.getTime() + 86400000 * 2))).toBe(2);
    expect(withinDays(a, a, 0)).toBe(true);
    expect(withinDays(new Date(a.getTime() + 1), a, 5)).toBe(false);
  });
  it('clips', () => {
    expect(clip('short', 10)).toBe('short');
    expect(clip('battery and inverter installation', 20)).toBe('battery and inverte…');
    expect(clip('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghi…');
  });
});
