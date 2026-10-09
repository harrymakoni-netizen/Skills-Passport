import { describe, expect, it } from 'vitest';
import {
  checkCaptureDate,
  checkClientIsRegisteredPhone,
  checkConfirmationRing,
  checkDuplicateImage,
  checkLocation,
  checkRecentlyRegisteredClient,
  checkRepeatedIncidents,
  checkSameClientRepeat,
  checkSuspectImage,
  checkVerifierApprovalRate,
  checkVerifierConflict,
  hammingDistance,
  haversineKm,
} from '../src/fraud';
import { cfg, day } from './helpers';

const c = cfg();
const hour = (h: number) => new Date(day(10).getTime() + h * 3600000);

describe('FR01 client phone is the artisan or a registered user → block', () => {
  it.each([
    ['different, unregistered', { clientPhoneHash: 'a', artisanPhoneHash: 'b', belongsToRegisteredArtisanOrVerifier: false }, null],
    ['own phone', { clientPhoneHash: 'a', artisanPhoneHash: 'a', belongsToRegisteredArtisanOrVerifier: true }, 'own'],
    ['another artisan or verifier', { clientPhoneHash: 'a', artisanPhoneHash: 'b', belongsToRegisteredArtisanOrVerifier: true }, 'registered'],
  ])('%s', (_n, input, expected) => {
    const r = checkClientIsRegisteredPhone(input);
    if (!expected) return expect(r).toBeNull();
    expect(r?.action).toBe('block');
    expect(r?.reason).toMatch(expected === 'own' ? /own number/ : /registered/);
  });
});

describe('FR02 same client repeat', () => {
  it.each([
    [[], null],
    [[day(5)], null],
    [[day(5), day(8)], 'standard'],
    [[day(-40), day(-35)], null],
    [[day(-40), day(5)], null],
  ])('%#', (prior, severity) => {
    const r = checkSameClientRepeat({ priorConfirmations: prior, now: day(10) }, c);
    expect(r?.severity ?? null).toBe(severity);
  });
});

describe('FR03 confirmation ring', () => {
  const conf = (n: number, at = day(5)) => Array.from({ length: n }, (_, i) => ({ artisanId: `a${i}`, at }));
  it.each([
    [conf(5), null],
    [conf(6), 'high'],
    [[...conf(5), ...conf(6, day(-60))], null],
    [[...conf(5), { artisanId: 'a1', at: day(6) }], null],
  ])('%#', (confirmations, severity) => {
    expect(checkConfirmationRing({ confirmations, now: day(10) }, c)?.severity ?? null).toBe(severity);
  });
});

describe('FR04 duplicate image', () => {
  it('hamming distance', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hammingDistance('0000000000000001', '0000000000000003')).toBe(1);
    expect(() => hammingDistance('00', '000')).toThrow();
  });
  it.each([
    ['identical', '8f0f0f0f0f0f0f0f', true],
    ['3 bits apart', '8f0f0f0f0f0f0f08', true],
    ['far apart', '70f0f0f0f0f0f0f0', false],
  ])('%s', (_n, other, flagged) => {
    const r = checkDuplicateImage({ phash: '8f0f0f0f0f0f0f0f', candidates: [{ mediaId: 'm', jobId: 'j', phash: other }] }, c);
    expect(r !== null).toBe(flagged);
  });
  it('no candidates', () => {
    expect(checkDuplicateImage({ phash: '0000000000000000', candidates: [] }, c)).toBeNull();
  });
  it('threshold from config', () => {
    const strict = cfg((x) => (x.fraud.phashMaxDistance = 1));
    expect(checkDuplicateImage({ phash: '0000000000000000', candidates: [{ mediaId: 'm', jobId: 'j', phash: '0000000000000001' }] }, strict)).toBeNull();
  });
});

describe('FR05 capture date', () => {
  it.each([
    [null, null],
    [day(9), null],
    [day(-20), null],
    [day(-21), 'soft'],
  ])('%#', (capturedAt, severity) => {
    expect(checkCaptureDate({ capturedAt, jobDate: day(10) }, c)?.severity ?? null).toBe(severity);
  });
});

describe('FR06 suspect image', () => {
  it.each([
    [null, null],
    [{ quality_ok: true, looks_like_trade_work: true, possible_stock_or_screenshot: false }, null],
    [{ quality_ok: true, looks_like_trade_work: true, possible_stock_or_screenshot: true }, /screenshot/],
    [{ quality_ok: false, looks_like_trade_work: false, possible_stock_or_screenshot: false }, /does not look/],
  ])('%#', (checks, reason) => {
    const r = checkSuspectImage(checks);
    if (!reason) return expect(r).toBeNull();
    expect(r?.reason).toMatch(reason);
  });
});

describe('FR07 location mismatch', () => {
  const mbare = { lat: -17.857, lng: 31.04 };
  const bulawayo = { lat: -20.15, lng: 28.58 };
  it('haversine', () => {
    expect(Math.round(haversineKm(mbare, bulawayo))).toBeGreaterThan(300);
    expect(haversineKm(mbare, mbare)).toBe(0);
  });
  it.each([
    [null, mbare, null],
    [mbare, null, null],
    [{ lat: -17.86, lng: 31.05 }, mbare, null],
    [bulawayo, mbare, 'soft'],
  ])('%#', (shared, area, severity) => {
    expect(checkLocation({ shared, area }, c)?.severity ?? null).toBe(severity);
  });
});

describe('FR08 recently registered client (PLAN Q12)', () => {
  it.each([
    ['first seen on this job', { clientFirstSeenAt: hour(0), firstSeenForOtherArtisan: false, registeredAsUserAt: null, jobSubmittedAt: hour(0) }, false],
    ['first seen for another artisan 2h earlier', { clientFirstSeenAt: hour(0), firstSeenForOtherArtisan: true, registeredAsUserAt: null, jobSubmittedAt: hour(2) }, true],
    ['first seen for another artisan 25h earlier', { clientFirstSeenAt: hour(0), firstSeenForOtherArtisan: true, registeredAsUserAt: null, jobSubmittedAt: hour(25) }, false],
    ['registered as user 3h earlier', { clientFirstSeenAt: hour(3), firstSeenForOtherArtisan: false, registeredAsUserAt: hour(0), jobSubmittedAt: hour(3) }, true],
    ['registered as user long ago', { clientFirstSeenAt: hour(100), firstSeenForOtherArtisan: false, registeredAsUserAt: hour(0), jobSubmittedAt: hour(100) }, false],
  ])('%s', (_n, input, flagged) => {
    expect(checkRecentlyRegisteredClient(input, c) !== null).toBe(flagged);
  });
});

describe('FR09 repeated incidents → freeze', () => {
  it.each([
    [[], null],
    [[day(5)], null],
    [[day(5), day(9)], 'freeze'],
    [[day(-100), day(9)], null],
  ])('%#', (incidents, action) => {
    expect(checkRepeatedIncidents({ incidents, now: day(10) }, c)?.action ?? null).toBe(action);
  });
});

describe('FR10/FR11 verifier rules', () => {
  it('conflict', () => {
    expect(checkVerifierConflict({ conflictedArtisanIds: ['a'], artisanId: 'a' })?.action).toBe('block');
    expect(checkVerifierConflict({ conflictedArtisanIds: ['a'], artisanId: 'b' })).toBeNull();
  });
  it.each([
    [{ reviews: 10, meets: 10 }, null],
    [{ reviews: 20, meets: 19 }, null],
    [{ reviews: 20, meets: 20 }, 'standard'],
    [{ reviews: 40, meets: 39 }, 'standard'],
  ])('%#', (input, severity) => {
    expect(checkVerifierApprovalRate(input, c)?.severity ?? null).toBe(severity);
  });
});
