import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { handleInbound, nudgeText, type ArtisanView, type FlowPorts, type Session } from '../src/flows';
import type { InboundContent, OutboundMessage } from '../src/messages';

const NOW = new Date('2026-10-09T10:00:00Z');
const TRADES = [
  { id: 'sol', code: 'SOL', name: { en: 'Solar PV installation', sn: 'Solar', nd: 'Solar' } },
  { id: 'wld', code: 'WLD', name: { en: 'Welding', sn: 'Welding', nd: 'Welding' } },
];

function fakePorts() {
  const artisans = new Map<string, ArtisanView & { input?: unknown }>();
  const calls: { name: string; args: unknown }[] = [];
  const rec = (name: string, args?: unknown) => calls.push({ name, args });
  const ports: FlowPorts = {
    now: () => NOW,
    config: () => DEFAULT_CONFIG,
    publicBaseUrl: () => 'https://sp.test',
    consentAudioKey: (l) => `consent-${l}.ogg`,
    listTrades: async () => TRADES,
    listCities: async () => [{ cityCode: 'HRE', city: 'Harare' }, { cityCode: 'BYO', city: 'Bulawayo' }],
    listAreas: async (c) => (c === 'HRE' ? [{ id: 'mbare', name: 'Mbare' }, { id: 'glen', name: 'Glen View' }] : [{ id: 'mak', name: 'Makokoba' }]),
    listJobTypes: async () => [
      { id: 'jt1', name: { en: 'Battery and inverter installation', sn: 'x', nd: 'y' }, needsBeforePhoto: true },
      { id: 'jt2', name: { en: 'Panel mounting', sn: 'x', nd: 'y' }, needsBeforePhoto: false },
    ],
    findArtisanByPhone: async (p) => artisans.get(p) ?? null,
    createArtisan: async (input) => {
      rec('createArtisan', input);
      const a: ArtisanView = {
        id: 'art1', firstName: input.fullName.split(' ')[0]!, displayName: 'Tendai M.', passportCode: 'SP-HRE-00001',
        lang: input.lang, level: 'starter', status: 'active', showFullName: false,
        trades: TRADES.filter((tr) => input.tradeIds.includes(tr.id)), areaId: input.areaId, areaName: 'Mbare', cityCode: 'HRE', phoneHash: 'h',
      };
      artisans.set(input.phone, a);
      return a;
    },
    updateArtisan: async (id, patch) => {
      rec('updateArtisan', patch);
      for (const a of artisans.values()) if (a.id === id) Object.assign(a, patch.lang ? { lang: patch.lang } : {}, patch.showFullName !== undefined ? { showFullName: patch.showFullName } : {});
    },
    deleteArtisan: async (id) => {
      rec('deleteArtisan', id);
      for (const a of artisans.values()) if (a.id === id) a.status = 'deleted';
    },
    createDraftJob: async (i) => (rec('createDraftJob', i), { jobId: 'job1' }),
    attachMedia: async (i) => void rec('attachMedia', i),
    checkClientPhone: async ({ phone }) => (phone === '+263770000001' ? 'own' : phone === '+263770000099' ? 'registered' : phone === '+263770000098' ? 'blocked' : 'ok'),
    submitJob: async (id, i) => (rec('submitJob', { id, ...i }), { ref: 'J-ABCDE' }),
    discardDraftJob: async (id) => void rec('discardDraftJob', id),
    getPassportStatus: async () => ({
      code: 'SP-HRE-00001', level: 'starter', frozen: false, countedJobs: 1, distinctClients: 1, averageRating: null, link: 'https://sp.test/p/SP-HRE-00001',
      next: { level: 'bronze', items: [{ key: 'jobs', have: 1, need: 3, met: false }, { key: 'clients', have: 1, need: 3, met: false }] },
    }),
    listWaitingJobs: async () => [{ jobId: 'job9', ref: 'J-WAIT1', jobType: { en: 'Panel mounting', sn: 'x', nd: 'y' }, clientName: 'Mrs Dube', sentAt: NOW, remindersSent: 0 }],
    remindClient: async () => 'sent',
    changeClientPhone: async () => 'ok',
    confirmSummary: async () => ({ ref: 'J-ABCDE' }),
    correctSummary: async (id, c) => (rec('correctSummary', { id, c }), { ref: 'J-ABCDE' }),
    clientRespond: async ({ action }) => (action === 'yes' ? { result: 'confirmed', lang: 'en', link: 'https://sp.test/c/tok' } : action === 'no' ? { result: 'disputed', lang: 'en' } : { result: 'stopped', lang: 'en' }),
    confirmOwnership: async () => ({ ref: 'J-OWN01' }),
    getShareAssets: async () => ({ link: 'https://sp.test/p/SP-HRE-00001', qrUrl: 'https://sp.test/p/SP-HRE-00001/qr.png', cardUrl: 'https://sp.test/p/SP-HRE-00001/card.png', tradeName: TRADES[0]!.name }),
    listOpenWorkRequests: async () => [{ id: 'wr1', buyerName: 'Sunrise NGO', area: 'Mbare', dates: 'Next week', description: 'Install 3 kVA system' }],
    respondWorkRequest: async ({ accept }) => (accept ? { ok: true, contactName: 'Mr Banda', contactPhone: '+263770000500' } : { ok: true }),
    recordHireOutcome: async () => ({ canLog: true, buyerName: 'Sunrise NGO' }),
    logHireAsJob: async () => ({ ref: 'J-HIRE1' }),
    requestFieldAgent: async () => void rec('requestFieldAgent'),
    listRecentClients: async () => [{ id: 'cl1', name: 'Mrs Dube' }],
    reportClient: async (i) => void rec('reportClient', i),
  };
  return { ports, calls, artisans };
}

const PHONE = '+263770000001';

function chat() {
  const f = fakePorts();
  let session: Session | null = null;
  let n = 0;
  const send = async (content: InboundContent | string): Promise<OutboundMessage[]> => {
    const c: InboundContent = typeof content === 'string' ? { kind: 'text', text: content } : content;
    const r = await handleInbound(f.ports, session, { providerMessageId: `m${++n}`, channel: 'mock', from: PHONE, receivedAt: NOW, content: c });
    session = r.session;
    return r.out;
  };
  const tap = (id: string) => send({ kind: 'choice', id });
  return { ...f, send, tap, session: () => session };
}

const bodyOf = (m: OutboundMessage | undefined) =>
  !m ? '' : m.kind === 'text' ? m.text : m.kind === 'buttons' || m.kind === 'list' ? m.body : m.kind === 'media' ? m.caption ?? '' : m.preview;
const idsOf = (m: OutboundMessage | undefined) =>
  !m ? [] : m.kind === 'buttons' ? m.buttons.map((b) => b.id) : m.kind === 'list' ? m.sections.flatMap((s) => s.rows.map((r) => r.id)) : [];

async function onboard(c: ReturnType<typeof chat>, birthYear = '1999') {
  await c.send('Hi');
  await c.tap('lang:en');
  await c.send(birthYear);
  await c.tap('res:yes');
  await c.tap('consent:yes');
  await c.send('tendai moyo');
  await c.tap('trade:sol');
  await c.tap('trade:done');
  await c.tap('city:HRE');
  await c.tap('area:mbare');
  await c.tap('exp:3');
  await c.tap('learned:apprenticeship');
  await c.tap('demo:yes');
  await c.tap('gender:woman');
  await c.tap('dis:no');
  await c.tap('badge:yes');
  return c.tap('photo:skip');
}

describe('onboarding flow (SPEC 4.1)', () => {
  it('creates a passport', async () => {
    const c = chat();
    const first = await c.send('Hi');
    expect(bodyOf(first[0])).toContain('Choose your language');
    expect(idsOf(first[0])).toEqual(['lang:en', 'lang:sn', 'lang:nd']);
    const out = await onboard(c);
    expect(bodyOf(out[0])).toContain('SP-HRE-00001');
    expect(bodyOf(out[0])).toContain('https://sp.test/p/SP-HRE-00001');
    const created = c.calls.find((x) => x.name === 'createArtisan')!.args as Record<string, unknown>;
    expect(created).toMatchObject({
      fullName: 'Tendai Moyo', birthYear: 1999, tradeIds: ['sol'], areaId: 'mbare', experienceYears: 3,
      howLearned: 'apprenticeship', demographicsConsent: true, gender: 'woman', disability: 'no', publicBadges: ['women_in_trades'], lang: 'en',
    });
  });

  it.each([
    ['2010', 'aged 18 to 35'],
    ['1980', 'aged 18 to 35'],
  ])('rejects birth year %s', async (year, text) => {
    const c = chat();
    await c.send('Hi');
    await c.tap('lang:en');
    const out = await c.send(year);
    expect(bodyOf(out[0])).toContain(text);
  });

  it('asks the month at the age boundary', async () => {
    const c = chat();
    await c.send('Hi');
    await c.tap('lang:en');
    expect(bodyOf((await c.send('2008'))[0])).toContain('month');
    expect(bodyOf((await c.send('13'))[0])).toContain('1 to 12');
    expect(bodyOf((await c.send('11'))[0])).toContain('18 to 35'); // turns 18 in November → 17 now
    const c2 = chat();
    await c2.send('Hi');
    await c2.tap('lang:en');
    await c2.send('2008');
    expect(bodyOf((await c2.send('3'))[0])).toContain('Zimbabwe');
  });

  it('validates input and re-asks', async () => {
    const c = chat();
    await c.send('Hi');
    expect(idsOf((await c.send('blah'))[0])).toContain('lang:en');
    await c.tap('lang:sn');
    expect(bodyOf((await c.send('nineteen'))[0])).toContain('1999');
    await c.send('1999');
    await c.tap('res:yes');
    const voice = await c.tap('consent:listen');
    expect(voice[0]).toMatchObject({ kind: 'media', mediaType: 'audio', source: { key: 'consent-sn.ogg' } });
    await c.tap('consent:yes');
    expect(bodyOf((await c.send('Tendai'))[0])).toContain('Tendai Moyo');
  });

  it('declined consent or residency stops onboarding', async () => {
    const c = chat();
    await c.send('Hi');
    await c.tap('lang:en');
    await c.send('1999');
    expect(bodyOf((await c.tap('res:no'))[0])).toContain('only available in Zimbabwe');
    const c2 = chat();
    await c2.send('Hi');
    await c2.tap('lang:en');
    await c2.send('1999');
    await c2.tap('res:yes');
    expect(bodyOf((await c2.tap('consent:no'))[0])).toContain('not saved anything');
    expect(c2.session()).toBeNull();
  });

  it('supports two trades, an unlisted area and skipping demographics', async () => {
    const c = chat();
    await c.send('Hi');
    await c.tap('lang:en');
    await c.send('1999');
    await c.tap('res:yes');
    await c.tap('consent:yes');
    await c.send('Rudo Ncube');
    const more = await c.tap('trade:sol');
    expect(idsOf(more[0])).toEqual(['trade:more', 'trade:done']);
    const list = await c.tap('trade:more');
    expect(idsOf(list[0])).toEqual(['trade:wld']);
    await c.tap('trade:wld');
    await c.tap('city:HRE');
    const ack = await c.tap('area:other');
    expect(bodyOf(ack[0])).toContain('field agent');
    await c.tap('exp:0');
    await c.tap('learned:self_taught');
    await c.tap('demo:skip');
    await c.send({ kind: 'media', mediaType: 'image', providerMediaId: 'p1', mimeType: 'image/jpeg' });
    const created = c.calls.find((x) => x.name === 'createArtisan')!.args as Record<string, unknown>;
    expect(created).toMatchObject({ tradeIds: ['sol', 'wld'], areaPending: true, demographicsConsent: false, gender: null, profilePhoto: { providerMediaId: 'p1' } });
  });
});

describe('main menu and log a job (SPEC 4.2, 8)', () => {
  async function registered() {
    const c = chat();
    await onboard(c);
    return c;
  }

  it('shows the 7-item main menu', async () => {
    const c = await registered();
    const out = await c.send('menu');
    expect(idsOf(out[0])).toEqual(['menu:log', 'menu:passport', 'menu:waiting', 'menu:share', 'menu:requests', 'menu:help', 'menu:settings']);
  });

  it('logs a job end to end', async () => {
    const c = await registered();
    const types = await c.tap('menu:log');
    expect(idsOf(types[0])).toEqual(['jt:jt1', 'jt:jt2']);
    expect(bodyOf((await c.tap('jt:jt1'))[0])).toContain('before');
    expect(bodyOf((await c.tap('media:done'))[0])).toContain('at least one photo');
    await c.send({ kind: 'media', mediaType: 'image', providerMediaId: 'b1', mimeType: 'image/jpeg' });
    expect(bodyOf((await c.tap('media:done'))[0])).toContain('finished');
    await c.send({ kind: 'media', mediaType: 'image', providerMediaId: 'a1', mimeType: 'image/jpeg' });
    const vid = await c.send({ kind: 'media', mediaType: 'video', providerMediaId: 'v1', mimeType: 'video/mp4', durationSec: 30 });
    expect(bodyOf(vid[0])).toContain('(2)');
    expect(bodyOf((await c.send({ kind: 'media', mediaType: 'video', providerMediaId: 'v2', mimeType: 'video/mp4' }))[0])).toContain('maximum');
    expect(bodyOf((await c.tap('media:done'))[0])).toContain('voice note');
    expect(bodyOf((await c.send({ kind: 'media', mediaType: 'audio', providerMediaId: 'vo', mimeType: 'audio/ogg', durationSec: 200 }))[0])).toContain('longer than 2 minutes');
    await c.send({ kind: 'media', mediaType: 'audio', providerMediaId: 'vo', mimeType: 'audio/ogg', durationSec: 40 });
    await c.send('Mrs Dube');
    expect(bodyOf((await c.send('12345'))[0])).toContain('valid mobile number');
    expect(bodyOf((await c.send('0770000001'))[0])).toContain("can't confirm your own job");
    expect(bodyOf((await c.send('0770000099'))[0])).toContain('registered artisan');
    expect(bodyOf((await c.send('0770000098'))[0])).toContain("can't confirm jobs");
    expect(idsOf((await c.send({ kind: 'contact', phone: '+263 77 000 0123' }))[0])).toEqual(['date:today', 'date:yesterday', 'date:other']);
    await c.tap('date:other');
    expect(bodyOf((await c.send('31/02'))[0])).toContain('last 90 days');
    expect(bodyOf((await c.send('05/10'))[0])).toContain('Mbare');
    await c.tap('area:other');
    await c.tap('jarea:glen');
    await c.send({ kind: 'location', lat: -17.9, lng: 31.0 });
    expect(bodyOf((await c.send('lots'))[0])).toContain('number like 45');
    const summary = await c.send('$45.50');
    expect(bodyOf(summary[0])).toContain('Battery and inverter installation');
    expect(bodyOf(summary[0])).toContain('Glen View');
    expect(bodyOf(summary[0])).toContain('US$45.50');
    expect(bodyOf(summary[0])).toContain('5 Oct');
    const done = await c.tap('job:submit');
    expect(bodyOf(done[0])).toContain('J-ABCDE');
    const submitted = c.calls.find((x) => x.name === 'submitJob')!.args;
    expect(submitted).toMatchObject({ clientName: 'Mrs Dube', clientPhone: '+263770000123', jobDate: '2026-10-05', areaId: 'glen', amountCents: 4550, location: { lat: -17.9, lng: 31 } });
    expect(c.calls.filter((x) => x.name === 'attachMedia').map((x) => (x.args as { kind: string }).kind)).toEqual(['photo_before', 'photo_after', 'video', 'voice']);
  });

  it('guided questions, today, skips and cancel', async () => {
    const c = await registered();
    await c.tap('menu:log');
    await c.tap('jt:jt2');
    await c.tap('media:done'); // optional before photos skipped
    await c.send({ kind: 'media', mediaType: 'image', providerMediaId: 'a1', mimeType: 'image/jpeg' });
    await c.tap('media:done');
    expect(bodyOf((await c.tap('voice:questions'))[0])).toContain('1 of 3');
    await c.send('Mounted six panels on the roof');
    await c.send({ kind: 'media', mediaType: 'audio', providerMediaId: 'q2', mimeType: 'audio/ogg' });
    await c.send('Roof was weak so I added a beam');
    await c.send('Mr Sibanda');
    await c.send('0770000124');
    await c.tap('date:today');
    await c.tap('area:same');
    await c.tap('loc:skip');
    const summary = await c.tap('amount:skip');
    expect(bodyOf(summary[0])).toContain('not given');
    expect(bodyOf(summary[0])).toContain('9 Oct');
    const out = await c.tap('job:cancel');
    expect(bodyOf(out[0])).toContain('Cancelled');
    expect(c.calls.some((x) => x.name === 'discardDraftJob')).toBe(true);
  });

  it('resumes an interrupted job', async () => {
    const c = await registered();
    await c.tap('menu:log');
    await c.tap('jt:jt2');
    const resume = await c.send('hi');
    expect(bodyOf(resume[0])).toContain('Continue where you left off');
    const again = await c.tap('resume:continue');
    expect(bodyOf(again[0])).toContain('before');
    await c.send('menu');
    const out = await c.tap('resume:discard');
    expect(bodyOf(out[0])).toContain('Discarded');
  });

  it('my passport shows the next-level checklist', async () => {
    const c = await registered();
    const out = await c.tap('menu:passport');
    expect(bodyOf(out[0])).toContain('SP-HRE-00001');
    expect(bodyOf(out[0])).toContain('To reach *Bronze*');
    expect(bodyOf(out[0])).toContain('Confirmed jobs: 1 of 3');
  });

  it('share, waiting, requests, help and settings', async () => {
    const c = await registered();
    const share = await c.tap('menu:share');
    expect(share.map((m) => m.kind)).toEqual(['text', 'text', 'media', 'media']);
    await c.tap('menu:waiting');
    expect(bodyOf((await c.tap('wj:job9'))[0])).toContain('J-WAIT1');
    expect(bodyOf((await c.tap('wa:remind'))[0])).toContain('Reminder sent');
    await c.tap('menu:waiting');
    await c.tap('wj:job9');
    await c.tap('wa:change');
    expect(bodyOf((await c.send('0770000125'))[0])).toContain('Updated');
    await c.tap('menu:requests');
    expect(idsOf((await c.tap('wr:wr1'))[0])).toEqual(['wr_accept:wr1', 'wr_decline:wr1']);
    expect(bodyOf((await c.tap('wr_accept:wr1'))[0])).toContain('Mr Banda');
    await c.tap('menu:help');
    expect(bodyOf((await c.tap('help:faq'))[0])).toContain('not an official trade-test certificate');
    await c.tap('menu:help');
    await c.tap('help:report');
    await c.tap('rc:cl1');
    expect(bodyOf((await c.tap('rr:unsafe'))[0])).toContain('995');
    expect(c.calls.find((x) => x.name === 'reportClient')!.args).toMatchObject({ clientId: 'cl1', reason: 'unsafe' });
    await c.tap('menu:settings');
    await c.tap('set:language');
    expect(bodyOf((await c.tap('slang:nd'))[0])).toContain('Ulimi');
    await c.tap('menu:settings');
    await c.tap('set:delete');
    expect(bodyOf((await c.tap('del:yes'))[0])).toContain('icinyiwe');
  });

  it('handles AI summary correction and global payloads', async () => {
    const c = await registered();
    expect(bodyOf((await c.tap('sum_fix:job1'))[0])).toContain('correct description');
    expect(bodyOf((await c.send('Installed 3 kVA inverter and two batteries'))[0])).toContain('updated the description');
    expect(c.calls.find((x) => x.name === 'correctSummary')!.args).toMatchObject({ id: 'job1', c: { text: 'Installed 3 kVA inverter and two batteries' } });
    expect(bodyOf((await c.tap('own_yes:job2'))[0])).toContain('J-OWN01');
    expect(bodyOf((await c.tap('hire_yes:wr1'))[0])).toContain('Log it');
    expect(bodyOf((await c.tap('hire_log:wr1'))[0])).toContain('J-HIRE1');
    expect(bodyOf((await c.tap('menu_passport'))[0])).toContain('Your Skills Passport');
  });
});

describe('client replies (SPEC 4.3)', () => {
  it.each([
    ['cc_yes:conf1', 'confirmed'],
    ['cc_no:conf1', 'look into'],
    ['cc_stop:conf1', 'not receive more messages'],
  ])('%s', async (id, text) => {
    const c = chat();
    const out = await c.tap(id);
    expect(bodyOf(out[0])).toContain(text);
  });
});

describe('nudges (SPEC 8)', () => {
  it.each([
    [{ level: 'bronze' as const, items: [{ key: 'jobs' as const, have: 1, need: 3, met: false }, { key: 'clients' as const, have: 1, need: 3, met: false }] }, '2 more jobs from new clients to reach Bronze.'],
    [{ level: 'bronze' as const, items: [{ key: 'jobs' as const, have: 2, need: 3, met: false }, { key: 'clients' as const, have: 2, need: 3, met: false }] }, '1 more job from a new client to reach Bronze.'],
    [{ level: 'silver' as const, items: [{ key: 'jobs' as const, have: 3, need: 5, met: false }, { key: 'clients' as const, have: 4, need: 4, met: true }] }, '2 more confirmed jobs to reach Silver.'],
    [{ level: 'silver' as const, items: [{ key: 'jobs' as const, have: 4, need: 5, met: false }] }, '1 more confirmed job to reach Silver.'],
    [{ level: 'silver' as const, items: [{ key: 'endorsements' as const, have: 0, need: 1, met: false }] }, 'Next level: Silver.'],
  ])('%#', (next, expected) => {
    expect(nudgeText('en', next)).toContain(expected);
  });
  it('null when nothing is missing or at gold', () => {
    expect(nudgeText('en', null)).toBeNull();
    expect(nudgeText('en', { level: 'bronze', items: [{ key: 'jobs', have: 3, need: 3, met: true }] })).toBeNull();
  });
});
