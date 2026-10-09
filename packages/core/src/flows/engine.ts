import { t, type MessageKey } from '../i18n';
import type { ChecklistItem, Level } from '../levels';
import type { InboundMessage, Lang, OutboundMessage } from '../messages';
import { normalisePhone } from '../phone';
import { ageAt, ageRangeFromYear, MAX_AGE, MIN_AGE } from '../passport';
import { formatDayMonthHarare, harareDateKey } from '../time';
import type { ArtisanView, FlowPorts, FlowResult, NewArtisanInput, Session } from './types';
import { buttons, choice, list, say, text } from './ui';

export const CONSENT_TEXT_VERSION = 'consent-v1';

type Ctx = {
  ports: FlowPorts;
  msg: InboundMessage;
  session: Session;
  artisan: ArtisanView | null;
  lang: Lang;
};

type Data = Record<string, unknown>;

const GREETINGS = new Set(['hi', 'hello', 'hey', 'start', 'mhoro', 'mhoroi', 'makadini', 'sawubona', 'salibonani', 'helo']);
const MENU_WORDS = new Set(['menu', 'menyu', 'imenyu', '0']);
const HELP_WORDS = new Set(['help', 'rubatsiro', 'uncedo']);

function newSession(lang: Lang, now: Date): Session {
  return { flow: null, step: '', data: {}, lang, pending: null, updatedAt: now.toISOString() };
}

function textOf(msg: InboundMessage): string | null {
  return msg.content.kind === 'text' ? msg.content.text.trim() : null;
}

function choiceOf(msg: InboundMessage): string | null {
  return msg.content.kind === 'choice' ? msg.content.id : null;
}

const done = (ctx: Ctx, out: OutboundMessage[]): FlowResult => ({
  session: { ...ctx.session, flow: null, step: '', data: {}, updatedAt: ctx.ports.now().toISOString() },
  out,
});

const go = (ctx: Ctx, flow: Session['flow'], step: string, data: Data, out: OutboundMessage[]): FlowResult => ({
  session: { ...ctx.session, flow, step, data, updatedAt: ctx.ports.now().toISOString() },
  out,
});

// ======================================================================== entry point

/**
 * Handles one inbound message for one phone. Pure apart from calls to `ports`.
 * Returns the new session (null = delete) and the messages to send back to the same phone.
 */
export async function handleInbound(ports: FlowPorts, prior: Session | null, msg: InboundMessage): Promise<FlowResult> {
  const artisan = await ports.findArtisanByPhone(msg.from);
  const lang: Lang = artisan?.lang ?? prior?.lang ?? 'en';
  const session = prior ?? newSession(lang, ports.now());
  const ctx: Ctx = { ports, msg, session: { ...session, lang: artisan?.lang ?? session.lang }, artisan, lang: artisan?.lang ?? session.lang };

  // 1. Global payloads from template buttons and notifications (work from any state).
  const id = choiceOf(msg);
  if (id) {
    const global = await handleGlobalChoice(ctx, id);
    if (global) return global;
  }

  // 2. A pending one-off answer (e.g. correcting an AI summary).
  if (ctx.session.pending && artisan) {
    const pending = await handlePending(ctx);
    if (pending) return pending;
  }

  const word = textOf(msg)?.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() ?? '';

  // 3. Not registered: onboarding (or carry on with it).
  if (!artisan || artisan.status === 'deleted') {
    if (ctx.session.flow === 'onboarding' && !GREETINGS.has(word)) return onboarding(ctx);
    return startOnboarding(ctx);
  }

  // 4. Global words.
  if (GREETINGS.has(word) || MENU_WORDS.has(word)) {
    if (ctx.session.flow === 'log_job' && ctx.session.data.jobId) return askResume(ctx);
    return done(ctx, [mainMenu(ctx.lang, artisan)]);
  }
  if (HELP_WORDS.has(word)) return go(ctx, 'help', 'help.menu', {}, [helpMenu(ctx.lang)]);

  // 5. Resume prompt answers.
  if (id === 'resume:continue') return go(ctx, 'log_job', ctx.session.step, ctx.session.data, await promptLogJob(ctx, ctx.session.step, ctx.session.data));
  if (id === 'resume:discard') {
    const jobId = ctx.session.data.jobId as string | undefined;
    if (jobId) await ports.discardDraftJob(jobId);
    return done(ctx, [say(ctx.lang, 'job.discarded'), mainMenu(ctx.lang, artisan)]);
  }

  // 6. Menu selections work from anywhere (they replace the current flow, except an in-progress job).
  if (id?.startsWith('menu:')) {
    if (ctx.session.flow === 'log_job' && ctx.session.data.jobId && id !== 'menu:log') return askResume(ctx);
    return menuSelect(ctx, id.slice(5));
  }

  // 7. Continue the current flow.
  switch (ctx.session.flow) {
    case 'log_job':
      return logJob(ctx);
    case 'waiting':
      return waiting(ctx);
    case 'help':
      return help(ctx);
    case 'settings':
      return settings(ctx);
    case 'work_requests':
      return workRequests(ctx);
    case 'onboarding':
      return done(ctx, [say(ctx.lang, 'ob.already', { code: artisan.passportCode }), mainMenu(ctx.lang, artisan)]);
    default:
      return done(ctx, [mainMenu(ctx.lang, artisan)]);
  }
}

// ======================================================================== global choices

async function handleGlobalChoice(ctx: Ctx, id: string): Promise<FlowResult | null> {
  const [action, ref] = id.split(':') as [string, string | undefined];
  const { ports, msg } = ctx;
  if ((action === 'cc_yes' || action === 'cc_no' || action === 'cc_stop') && ref) {
    const res = await ports.clientRespond({
      phone: msg.from,
      confirmationId: ref,
      action: action === 'cc_yes' ? 'yes' : action === 'cc_no' ? 'no' : 'stop',
    });
    if (res.result === 'not_found') return { session: ctx.session, out: [say(ctx.lang, 'cc.expired')] };
    const l = res.lang;
    const out =
      res.result === 'confirmed'
        ? say(l, 'cc.thanks_yes', { link: res.link })
        : res.result === 'disputed'
          ? say(l, 'cc.thanks_no')
          : res.result === 'stopped'
            ? say(l, 'cc.stopped')
            : res.result === 'already'
              ? say(l, 'cc.already')
              : say(l, 'cc.expired');
    return { session: ctx.artisan ? ctx.session : null, out: [out] };
  }
  if (!ctx.artisan) return null;
  const a = ctx.artisan;
  if ((action === 'sum_ok' || action === 'sum_fix') && ref) {
    if (action === 'sum_ok') {
      await ports.confirmSummary(ref);
      return { session: ctx.session, out: [say(ctx.lang, 'sum.ok')] };
    }
    return { session: { ...ctx.session, pending: { kind: 'fix_summary', jobId: ref } }, out: [say(ctx.lang, 'sum.fix_prompt')] };
  }
  if ((action === 'own_yes' || action === 'own_no') && ref) {
    const res = await ports.confirmOwnership({ artisanId: a.id, jobId: ref, mine: action === 'own_yes' });
    if (!res) return { session: ctx.session, out: [say(ctx.lang, 'cc.already')] };
    return { session: ctx.session, out: [say(ctx.lang, action === 'own_yes' ? 'own.confirmed' : 'own.denied', { ref: res.ref })] };
  }
  if ((action === 'wr_accept' || action === 'wr_decline') && ref) {
    return respondToRequest(ctx, ref, action === 'wr_accept');
  }
  if ((action === 'hire_yes' || action === 'hire_no') && ref) {
    const res = await ports.recordHireOutcome({ phone: msg.from, requestId: ref, happened: action === 'hire_yes' });
    if (res?.canLog) {
      return {
        session: ctx.session,
        out: [buttons(t(ctx.lang, 'hire.ask_log', { buyer: res.buyerName }), [choice(ctx.lang, `hire_log:${ref}`, 'hire.btn.log'), choice(ctx.lang, 'menu:menu', 'common.no')])],
      };
    }
    return { session: ctx.session, out: [say(ctx.lang, 'hire.thanks')] };
  }
  if (action === 'hire_log' && ref) {
    const res = await ports.logHireAsJob({ artisanId: a.id, requestId: ref });
    return { session: ctx.session, out: [res ? say(ctx.lang, 'job.submitted', { ref: res.ref, client: '—' }) : say(ctx.lang, 'wr.closed')] };
  }
  if (action === 'menu_passport') return { session: ctx.session, out: await passportStatus(ctx) };
  return null;
}

async function handlePending(ctx: Ctx): Promise<FlowResult | null> {
  const p = ctx.session.pending;
  if (!p || p.kind !== 'fix_summary') return null;
  const c = ctx.msg.content;
  let res: { ref: string } | null = null;
  if (c.kind === 'text' && c.text.trim().length > 3) res = await ctx.ports.correctSummary(p.jobId, { text: c.text.trim() });
  else if (c.kind === 'media' && c.mediaType === 'audio')
    res = await ctx.ports.correctSummary(p.jobId, { providerMediaId: c.providerMediaId, mimeType: c.mimeType });
  else return null;
  return {
    session: { ...ctx.session, pending: null },
    out: res ? [say(ctx.lang, 'sum.fixed', { ref: res.ref })] : [say(ctx.lang, 'common.error')],
  };
}

// ======================================================================== main menu

export function mainMenu(lang: Lang, artisan: ArtisanView): OutboundMessage {
  const rows: [string, MessageKey, MessageKey][] = [
    ['log', 'menu.log_job', 'menu.log_job.desc'],
    ['passport', 'menu.passport', 'menu.passport.desc'],
    ['waiting', 'menu.waiting', 'menu.waiting.desc'],
    ['share', 'menu.share', 'menu.share.desc'],
    ['requests', 'menu.work_requests', 'menu.work_requests.desc'],
    ['help', 'menu.help', 'menu.help.desc'],
    ['settings', 'menu.settings', 'menu.settings.desc'],
  ];
  const msg = list(
    lang,
    t(lang, 'menu.body', { name: artisan.firstName }),
    rows.map(([id, title, desc]) => ({ id: `menu:${id}`, title: t(lang, title), description: t(lang, desc) })),
  );
  if (msg.kind === 'list') msg.buttonLabel = t(lang, 'menu.button');
  return msg;
}

async function menuSelect(ctx: Ctx, item: string): Promise<FlowResult> {
  const a = ctx.artisan!;
  const { lang, ports } = ctx;
  switch (item) {
    case 'log':
      return startLogJob(ctx);
    case 'passport':
      return done(ctx, await passportStatus(ctx));
    case 'waiting': {
      const jobs = await ports.listWaitingJobs(a.id);
      if (jobs.length === 0) return done(ctx, [say(lang, 'waiting.none')]);
      return go(ctx, 'waiting', 'waiting.pick', {}, [
        list(
          lang,
          t(lang, 'waiting.list'),
          jobs.slice(0, 10).map((j) => ({ id: `wj:${j.jobId}`, title: `${j.ref} · ${j.clientName}`, description: j.jobType[lang] })),
        ),
      ]);
    }
    case 'share': {
      const s = await ports.getShareAssets(a.id);
      return done(ctx, [
        say(lang, 'share.intro'),
        text(t(lang, 'share.text', { name: a.displayName, trade: s.tradeName[lang], level: t(lang, `level.${a.level}` as MessageKey), link: s.link })),
        { kind: 'media', mediaType: 'image', source: { url: s.qrUrl }, caption: t(lang, 'share.qr_caption', { code: a.passportCode }) },
        { kind: 'media', mediaType: 'image', source: { url: s.cardUrl }, caption: t(lang, 'share.card_caption') },
      ]);
    }
    case 'requests': {
      const reqs = await ports.listOpenWorkRequests(a.id);
      if (reqs.length === 0) return done(ctx, [say(lang, 'wr.none')]);
      return go(ctx, 'work_requests', 'wr.pick', {}, [
        list(lang, t(lang, 'wr.list'), reqs.slice(0, 10).map((r) => ({ id: `wr:${r.id}`, title: r.buyerName, description: `${r.area} · ${r.description}` }))),
      ]);
    }
    case 'help':
      return go(ctx, 'help', 'help.menu', {}, [helpMenu(lang)]);
    case 'settings':
      return go(ctx, 'settings', 'settings.menu', {}, [settingsMenu(lang, a)]);
    default:
      return done(ctx, [mainMenu(lang, a)]);
  }
}

// ======================================================================== my passport

function checklistLine(lang: Lang, item: ChecklistItem): string {
  const mark = item.met ? t(lang, 'check.met') : t(lang, 'check.todo');
  return `${mark} ${t(lang, `check.${item.key}` as MessageKey, { have: item.have, need: item.need })}`;
}

export function levelName(lang: Lang, level: Level): string {
  return t(lang, `level.${level}` as MessageKey);
}

async function passportStatus(ctx: Ctx): Promise<OutboundMessage[]> {
  const { lang } = ctx;
  const s = await ctx.ports.getPassportStatus(ctx.artisan!.id);
  let next: string;
  if (s.frozen) next = t(lang, 'passport.frozen');
  else if (!s.next) next = t(lang, 'passport.at_gold');
  else
    next = [t(lang, 'passport.next_header', { level: levelName(lang, s.next.level) }), ...s.next.items.map((i) => checklistLine(lang, i))].join('\n');
  return [
    text(
      t(lang, 'passport.status', {
        code: s.code,
        level: levelName(lang, s.level),
        jobs: s.countedJobs,
        clients: s.distinctClients,
        rating: s.averageRating === null ? t(lang, 'passport.no_rating') : `${s.averageRating.toFixed(1)} / 5`,
        next,
        link: s.link,
      }),
    ),
  ];
}

/** "2 more jobs from new clients to reach Bronze" (SPEC 8 progress nudge). */
export function nudgeText(lang: Lang, next: { level: Level; items: ChecklistItem[] } | null): string | null {
  if (!next) return null;
  const level = levelName(lang, next.level);
  const missing = next.items.filter((i) => !i.met);
  if (missing.length === 0) return null;
  const jobs = missing.find((i) => i.key === 'jobs');
  const clients = missing.find((i) => i.key === 'clients');
  if (clients && (!jobs || clients.need - clients.have >= jobs.need - jobs.have)) {
    const n = clients.need - clients.have;
    return n === 1 ? t(lang, 'nudge.clients_one', { level }) : t(lang, 'nudge.clients', { n, level });
  }
  if (jobs) {
    const n = jobs.need - jobs.have;
    return n === 1 ? t(lang, 'nudge.jobs_one', { level }) : t(lang, 'nudge.jobs', { n, level });
  }
  return t(lang, 'nudge.other', { level });
}

// ======================================================================== onboarding

function startOnboarding(ctx: Ctx): FlowResult {
  return go(ctx, 'onboarding', 'ob.lang', {}, [obPrompt('ob.lang', ctx.lang, {})!]);
}

function obPrompt(step: string, lang: Lang, data: Data, extra?: { trades?: { id: string; name: string }[]; areas?: { id: string; name: string }[]; cities?: { cityCode: string; city: string }[] }): OutboundMessage | null {
  switch (step) {
    case 'ob.lang':
      return buttons(t('en', 'ob.welcome'), [
        { id: 'lang:en', title: t('en', 'lang.en') },
        { id: 'lang:sn', title: t('en', 'lang.sn') },
        { id: 'lang:nd', title: t('en', 'lang.nd') },
      ]);
    case 'ob.birth_year':
      return say(lang, 'ob.birth_year');
    case 'ob.birth_month':
      return say(lang, 'ob.birth_month');
    case 'ob.residency':
      return buttons(t(lang, 'ob.residency'), [choice(lang, 'res:yes', 'common.yes'), choice(lang, 'res:no', 'common.no')]);
    case 'ob.consent':
      return buttons(t(lang, 'ob.consent'), [
        choice(lang, 'consent:yes', 'ob.btn.agree'),
        choice(lang, 'consent:listen', 'ob.btn.listen'),
        choice(lang, 'consent:no', 'ob.btn.decline'),
      ]);
    case 'ob.name':
      return say(lang, 'ob.name');
    case 'ob.trade':
      return list(lang, t(lang, 'ob.trade'), (extra?.trades ?? []).filter((tr) => !((data.tradeIds as string[] | undefined) ?? []).includes(tr.id)).map((tr) => ({ id: `trade:${tr.id}`, title: tr.name })));
    case 'ob.city':
      return buttons(t(lang, 'ob.city'), (extra?.cities ?? []).slice(0, 3).map((c) => ({ id: `city:${c.cityCode}`, title: c.city })));
    case 'ob.area':
      return list(lang, t(lang, 'ob.area'), [
        ...(extra?.areas ?? []).slice(0, 9).map((a) => ({ id: `area:${a.id}`, title: a.name })),
        { id: 'area:other', title: t(lang, 'ob.area_other') },
      ]);
    case 'ob.experience':
      return list(lang, t(lang, 'ob.experience'), (['0', '1', '3', '6', '10'] as const).map((n) => ({ id: `exp:${n}`, title: t(lang, `exp.${n}`) })));
    case 'ob.how_learned':
      return list(
        lang,
        t(lang, 'ob.how_learned'),
        (['apprenticeship', 'family', 'self_taught', 'college', 'other'] as const).map((k) => ({ id: `learned:${k}`, title: t(lang, `learned.${k}`) })),
      );
    case 'ob.demographics':
      return buttons(t(lang, 'ob.demographics'), [choice(lang, 'demo:yes', 'ob.btn.ask_me'), choice(lang, 'demo:skip', 'common.skip')]);
    case 'ob.gender':
      return buttons(t(lang, 'ob.gender'), [choice(lang, 'gender:woman', 'gender.woman'), choice(lang, 'gender:man', 'gender.man'), choice(lang, 'gender:prefer_not', 'gender.prefer_not')]);
    case 'ob.disability':
      return buttons(t(lang, 'ob.disability'), [choice(lang, 'dis:yes', 'common.yes'), choice(lang, 'dis:no', 'common.no'), choice(lang, 'dis:prefer_not', 'gender.prefer_not')]);
    case 'ob.badge':
      return buttons(t(lang, 'ob.badge_women'), [choice(lang, 'badge:yes', 'common.yes'), choice(lang, 'badge:no', 'common.no')]);
    case 'ob.photo':
      return buttons(t(lang, 'ob.photo'), [choice(lang, 'photo:skip', 'common.skip')]);
    default:
      return null;
  }
}

async function obGo(ctx: Ctx, step: string, data: Data, before: OutboundMessage[] = []): Promise<FlowResult> {
  const { ports } = ctx;
  const lang = (data.lang as Lang | undefined) ?? ctx.lang;
  let extra: Parameters<typeof obPrompt>[3] = {};
  if (step === 'ob.trade') extra = { trades: (await ports.listTrades()).map((tr) => ({ id: tr.id, name: tr.name[lang] })) };
  if (step === 'ob.city') extra = { cities: await ports.listCities() };
  if (step === 'ob.area') extra = { areas: await ports.listAreas(data.cityCode as string) };
  const prompt = obPrompt(step, lang, data, extra);
  const r = go(ctx, 'onboarding', step, data, [...before, ...(prompt ? [prompt] : [])]);
  r.session!.lang = lang;
  return r;
}

async function onboarding(ctx: Ctx): Promise<FlowResult> {
  const { session, msg, ports } = ctx;
  const data: Data = { ...session.data };
  const lang = (data.lang as Lang | undefined) ?? ctx.lang;
  const id = choiceOf(msg);
  const txt = textOf(msg);
  const now = ports.now();
  const retry = (key: MessageKey) => obGo(ctx, session.step, data, [say(lang, key)]);

  switch (session.step) {
    case 'ob.lang': {
      const l = id?.startsWith('lang:') ? (id.slice(5) as Lang) : null;
      if (!l || !['en', 'sn', 'nd'].includes(l)) return obGo(ctx, 'ob.lang', data);
      data.lang = l;
      return obGo(ctx, 'ob.birth_year', data);
    }
    case 'ob.birth_year': {
      const y = txt && /^\d{4}$/.test(txt) ? Number(txt) : NaN;
      if (!Number.isFinite(y) || y < 1900 || y > now.getUTCFullYear()) return retry('ob.birth_year_invalid');
      data.birthYear = y;
      const [minAge, maxAge] = ageRangeFromYear(y, now);
      if (maxAge < MIN_AGE || minAge > MAX_AGE) return done(ctx, [say(lang, 'ob.age_out')]);
      if (minAge >= MIN_AGE && maxAge <= MAX_AGE) return obGo(ctx, 'ob.residency', data);
      return obGo(ctx, 'ob.birth_month', data);
    }
    case 'ob.birth_month': {
      const m = txt && /^\d{1,2}$/.test(txt) ? Number(txt) : NaN;
      if (!(m >= 1 && m <= 12)) return retry('ob.birth_month_invalid');
      const age = ageAt(data.birthYear as number, m, now);
      if (age < MIN_AGE || age > MAX_AGE) return done(ctx, [say(lang, 'ob.age_out')]);
      return obGo(ctx, 'ob.residency', data);
    }
    case 'ob.residency':
      if (id === 'res:no') return done(ctx, [say(lang, 'ob.residency_no')]);
      if (id !== 'res:yes') return obGo(ctx, session.step, data);
      return obGo(ctx, 'ob.consent', data);
    case 'ob.consent':
      if (id === 'consent:listen') {
        return obGo(ctx, 'ob.consent', data, [
          { kind: 'media', mediaType: 'audio', source: { key: ports.consentAudioKey(lang) }, caption: t(lang, 'ob.consent_voice_caption') },
        ]);
      }
      if (id === 'consent:no') return { session: null, out: [say(lang, 'ob.consent_declined')] };
      if (id !== 'consent:yes') return obGo(ctx, session.step, data);
      data.consentAt = now.toISOString();
      return obGo(ctx, 'ob.name', data);
    case 'ob.name': {
      const parts = (txt ?? '').split(/\s+/).filter((p) => /^[\p{L}'’-]{2,}$/u.test(p));
      if (parts.length < 2 || (txt ?? '').length > 80) return retry('ob.name_invalid');
      data.fullName = parts.map((p) => p[0]!.toUpperCase() + p.slice(1)).join(' ');
      return obGo(ctx, 'ob.trade', data);
    }
    case 'ob.trade': {
      if (id === 'trade:done') return obGo(ctx, 'ob.city', data);
      if (id === 'trade:more') return obGo(ctx, 'ob.trade', data);
      const tradeId = id?.startsWith('trade:') ? id.slice(6) : null;
      const trades = await ports.listTrades();
      const trade = trades.find((tr) => tr.id === tradeId);
      if (!trade) return obGo(ctx, 'ob.trade', data);
      const ids = [...((data.tradeIds as string[] | undefined) ?? []), trade.id].slice(0, 2);
      data.tradeIds = ids;
      if (ids.length >= 2) return obGo(ctx, 'ob.city', data);
      return go(ctx, 'onboarding', 'ob.trade', data, [
        buttons(t(lang, 'ob.trade_more', { trade: trade.name[lang] }), [choice(lang, 'trade:more', 'ob.btn.add_trade'), choice(lang, 'trade:done', 'common.continue')]),
      ]);
    }
    case 'ob.city': {
      const code = id?.startsWith('city:') ? id.slice(5) : null;
      const cities = await ports.listCities();
      if (!code || !cities.some((c) => c.cityCode === code)) return obGo(ctx, 'ob.city', data);
      data.cityCode = code;
      return obGo(ctx, 'ob.area', data);
    }
    case 'ob.area': {
      const areas = await ports.listAreas(data.cityCode as string);
      if (id === 'area:other') {
        data.areaId = areas[0]?.id;
        data.areaPending = true;
        return obGo(ctx, 'ob.experience', data, [say(lang, 'ob.area_other_ack', { area: areas[0]?.name ?? '' })]);
      }
      const area = areas.find((a) => `area:${a.id}` === id);
      if (!area) return obGo(ctx, 'ob.area', data);
      data.areaId = area.id;
      data.areaPending = false;
      return obGo(ctx, 'ob.experience', data);
    }
    case 'ob.experience': {
      const n = id?.startsWith('exp:') ? Number(id.slice(4)) : NaN;
      if (!Number.isFinite(n)) return obGo(ctx, session.step, data);
      data.experienceYears = n;
      return obGo(ctx, 'ob.how_learned', data);
    }
    case 'ob.how_learned': {
      const k = id?.startsWith('learned:') ? id.slice(8) : null;
      if (!k) return obGo(ctx, session.step, data);
      data.howLearned = k;
      return obGo(ctx, 'ob.demographics', data);
    }
    case 'ob.demographics':
      if (id === 'demo:yes') {
        data.demographicsConsent = true;
        return obGo(ctx, 'ob.gender', data);
      }
      if (id === 'demo:skip') {
        data.demographicsConsent = false;
        return obGo(ctx, 'ob.photo', data);
      }
      return obGo(ctx, session.step, data);
    case 'ob.gender': {
      const g = id?.startsWith('gender:') ? id.slice(7) : null;
      if (!g) return obGo(ctx, session.step, data);
      data.gender = g;
      return obGo(ctx, 'ob.disability', data);
    }
    case 'ob.disability': {
      const v = id?.startsWith('dis:') ? id.slice(4) : null;
      if (!v) return obGo(ctx, session.step, data);
      data.disability = v;
      return obGo(ctx, data.gender === 'woman' ? 'ob.badge' : 'ob.photo', data);
    }
    case 'ob.badge':
      if (id !== 'badge:yes' && id !== 'badge:no') return obGo(ctx, session.step, data);
      data.badgeWomen = id === 'badge:yes';
      return obGo(ctx, 'ob.photo', data);
    case 'ob.photo': {
      const c = msg.content;
      if (c.kind === 'media' && c.mediaType === 'image') data.photo = { providerMediaId: c.providerMediaId, mimeType: c.mimeType };
      else if (id !== 'photo:skip') return obGo(ctx, session.step, data);
      return finishOnboarding(ctx, data);
    }
    default:
      return startOnboarding(ctx);
  }
}

async function finishOnboarding(ctx: Ctx, data: Data): Promise<FlowResult> {
  const lang = data.lang as Lang;
  const input: NewArtisanInput = {
    phone: ctx.msg.from,
    lang,
    fullName: data.fullName as string,
    birthYear: data.birthYear as number,
    tradeIds: data.tradeIds as string[],
    areaId: data.areaId as string,
    areaPending: Boolean(data.areaPending),
    experienceYears: data.experienceYears as number,
    howLearned: data.howLearned as NewArtisanInput['howLearned'],
    demographicsConsent: Boolean(data.demographicsConsent),
    gender: (data.gender as NewArtisanInput['gender']) ?? null,
    disability: (data.disability as NewArtisanInput['disability']) ?? null,
    publicBadges: data.badgeWomen ? ['women_in_trades'] : [],
    profilePhoto: (data.photo as NewArtisanInput['profilePhoto']) ?? null,
    consentTextVersion: CONSENT_TEXT_VERSION,
  };
  const artisan = await ctx.ports.createArtisan(input);
  const link = `${ctx.ports.publicBaseUrl()}/p/${artisan.passportCode}`;
  return {
    session: { ...newSession(lang, ctx.ports.now()) },
    out: [
      say(lang, 'ob.done', { code: artisan.passportCode, link }),
      buttons(t(lang, 'common.menu_hint'), [choice(lang, 'menu:log', 'ob.btn.log_first'), { id: 'menu:menu', title: t(lang, 'menu.button') }]),
    ],
  };
}

// ======================================================================== log a job

function askResume(ctx: Ctx): FlowResult {
  const name = (ctx.session.data.jobTypeName as Record<Lang, string> | undefined)?.[ctx.lang] ?? '';
  return go(ctx, 'log_job', ctx.session.step, ctx.session.data, [
    buttons(t(ctx.lang, 'job.resume', { jobType: name }), [choice(ctx.lang, 'resume:continue', 'common.continue'), choice(ctx.lang, 'resume:discard', 'job.btn.discard')]),
  ]);
}

async function startLogJob(ctx: Ctx): Promise<FlowResult> {
  const a = ctx.artisan!;
  if (ctx.session.flow === 'log_job' && ctx.session.data.jobId) return askResume(ctx);
  if (a.trades.length > 1) {
    return go(ctx, 'log_job', 'job.trade', {}, [
      buttons(t(ctx.lang, 'job.choose_trade'), a.trades.map((tr) => ({ id: `jtrade:${tr.id}`, title: tr.name[ctx.lang] }))),
    ]);
  }
  const data: Data = { tradeId: a.trades[0]!.id };
  return go(ctx, 'log_job', 'job.type', data, await promptLogJob(ctx, 'job.type', data));
}

async function promptLogJob(ctx: Ctx, step: string, data: Data): Promise<OutboundMessage[]> {
  const { lang, ports } = ctx;
  const m = ports.config().media;
  switch (step) {
    case 'job.trade':
      return [buttons(t(lang, 'job.choose_trade'), ctx.artisan!.trades.map((tr) => ({ id: `jtrade:${tr.id}`, title: tr.name[lang] })))];
    case 'job.type': {
      const types = await ports.listJobTypes(data.tradeId as string);
      if (types.length === 0) return [say(lang, 'job.no_types')];
      return [list(lang, t(lang, 'job.choose_type'), types.slice(0, 10).map((jt) => ({ id: `jt:${jt.id}`, title: jt.name[lang] })))];
    }
    case 'job.before':
      return data.needsBefore
        ? [say(lang, 'job.before', { max: m.maxBeforePhotos })]
        : [buttons(t(lang, 'job.before_optional', { max: m.maxBeforePhotos }), [choice(lang, 'media:done', 'common.skip')])];
    case 'job.after':
      return [say(lang, 'job.after', { max: m.maxAfterPhotos })];
    case 'job.voice':
      return [buttons(t(lang, 'job.voice'), [choice(lang, 'voice:questions', 'job.btn.questions')])];
    case 'job.q1':
      return [say(lang, 'job.q1')];
    case 'job.q2':
      return [say(lang, 'job.q2')];
    case 'job.q3':
      return [say(lang, 'job.q3')];
    case 'job.client_name':
      return [say(lang, 'job.client_name')];
    case 'job.client_phone':
      return [say(lang, 'job.client_phone')];
    case 'job.date':
      return [
        buttons(t(lang, 'job.date'), [choice(lang, 'date:today', 'job.btn.today'), choice(lang, 'date:yesterday', 'job.btn.yesterday'), choice(lang, 'date:other', 'job.btn.other_date')]),
      ];
    case 'job.date_text':
      return [say(lang, 'job.date_ask')];
    case 'job.area':
      return [buttons(t(lang, 'job.area', { area: data.areaName as string }), [choice(lang, 'area:same', 'common.yes'), choice(lang, 'area:other', 'job.btn.other_area')])];
    case 'job.area_pick': {
      const areas = await ports.listAreas(ctx.artisan!.cityCode);
      return [list(lang, t(lang, 'ob.area'), areas.slice(0, 10).map((a) => ({ id: `jarea:${a.id}`, title: a.name })))];
    }
    case 'job.location':
      return [buttons(t(lang, 'job.location'), [choice(lang, 'loc:skip', 'common.skip')])];
    case 'job.amount':
      return [buttons(t(lang, 'job.amount'), [choice(lang, 'amount:skip', 'common.skip')])];
    case 'job.summary':
      return [summaryMessage(lang, data)];
    default:
      return [];
  }
}

function summaryMessage(lang: Lang, data: Data): OutboundMessage {
  const photos = Number(data.before ?? 0) + Number(data.after ?? 0);
  const video = Number(data.video ?? 0);
  const photoText = `${photos}${video ? ` + ${video} video` : ''}`;
  const amount = typeof data.amountCents === 'number' ? `US$${(data.amountCents / 100).toFixed(2)} (${t(lang, 'common.private')})` : t(lang, 'common.not_given');
  const date = new Date(`${data.jobDate as string}T12:00:00Z`);
  const voice = data.voice ? t(lang, 'common.received') : (data.notes as string[] | undefined)?.length ? `${(data.notes as string[]).length}/3` : t(lang, 'common.none');
  return buttons(
    t(lang, 'job.summary', {
      jobType: (data.jobTypeName as Record<Lang, string>)[lang],
      date: formatDayMonthHarare(date),
      area: data.areaName as string,
      photos: photoText,
      voice,
      client: data.clientName as string,
      amount,
    }),
    [choice(lang, 'job:submit', 'job.btn.submit'), choice(lang, 'job:restart', 'job.btn.restart'), choice(lang, 'job:cancel', 'common.cancel')],
  );
}

async function logStep(ctx: Ctx, step: string, data: Data, before: OutboundMessage[] = []): Promise<FlowResult> {
  return go(ctx, 'log_job', step, data, [...before, ...(await promptLogJob(ctx, step, data))]);
}

function parseDayMonth(input: string, now: Date): string | null {
  const m = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})(?:\s*[/.\-\s]\s*(\d{2,4}))?$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const todayKey = harareDateKey(now);
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(todayKey.slice(0, 4));
  const build = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let key = build(year);
  if (!m[3] && key > todayKey) key = build(--year);
  const d = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() + 1 !== month) return null;
  const today = new Date(`${todayKey}T12:00:00Z`);
  const ageDays = (today.getTime() - d.getTime()) / 86400000;
  if (ageDays < 0 || ageDays > 90) return null;
  return key;
}

async function logJob(ctx: Ctx): Promise<FlowResult> {
  const { session, msg, ports, lang } = ctx;
  const a = ctx.artisan!;
  const data: Data = { ...session.data };
  const id = choiceOf(msg);
  const txt = textOf(msg);
  const c = msg.content;
  const media = ports.config().media;
  const again = (key?: MessageKey, params?: Record<string, string | number>) =>
    logStep(ctx, session.step, data, key ? [say(lang, key, params)] : []);

  if (id === 'job:cancel') {
    if (data.jobId) await ports.discardDraftJob(data.jobId as string);
    return done(ctx, [say(lang, 'common.cancelled')]);
  }

  switch (session.step) {
    case 'job.trade': {
      const tradeId = id?.startsWith('jtrade:') ? id.slice(7) : null;
      if (!tradeId || !a.trades.some((tr) => tr.id === tradeId)) return again();
      return logStep(ctx, 'job.type', { tradeId });
    }
    case 'job.type': {
      const jtId = id?.startsWith('jt:') ? id.slice(3) : null;
      const types = await ports.listJobTypes(data.tradeId as string);
      const jt = types.find((x) => x.id === jtId);
      if (!jt) return again();
      const { jobId } = await ports.createDraftJob({ artisanId: a.id, tradeId: data.tradeId as string, jobTypeId: jt.id });
      Object.assign(data, { jobId, jobTypeId: jt.id, jobTypeName: jt.name, needsBefore: jt.needsBeforePhoto, before: 0, after: 0, video: 0, notes: [] });
      return logStep(ctx, 'job.before', data);
    }
    case 'job.before': {
      if (c.kind === 'media' && c.mediaType === 'image') {
        if (Number(data.before) >= media.maxBeforePhotos) return again('job.too_many');
        await ports.attachMedia({ jobId: data.jobId as string, kind: 'photo_before', providerMediaId: c.providerMediaId, mimeType: c.mimeType });
        data.before = Number(data.before) + 1;
        return go(ctx, 'log_job', 'job.before', data, [buttons(t(lang, 'job.media_more', { count: data.before as number }), [choice(lang, 'media:done', 'common.done')])]);
      }
      if (id === 'media:done') {
        if (data.needsBefore && Number(data.before) === 0) return again('job.need_photo');
        return logStep(ctx, 'job.after', data);
      }
      return again();
    }
    case 'job.after': {
      if (c.kind === 'media' && (c.mediaType === 'image' || c.mediaType === 'video')) {
        if (c.mediaType === 'video') {
          if (Number(data.video) >= 1) return again('job.too_many');
          if (c.durationSec && c.durationSec > media.maxVideoSeconds) return again('job.video_too_long', { max: media.maxVideoSeconds });
          data.video = 1;
        } else {
          if (Number(data.after) >= media.maxAfterPhotos) return again('job.too_many');
          data.after = Number(data.after) + 1;
        }
        await ports.attachMedia({
          jobId: data.jobId as string,
          kind: c.mediaType === 'video' ? 'video' : 'photo_after',
          providerMediaId: c.providerMediaId,
          mimeType: c.mimeType,
          ...(c.durationSec ? { durationSec: c.durationSec } : {}),
        });
        const count = Number(data.after) + Number(data.video);
        return go(ctx, 'log_job', 'job.after', data, [buttons(t(lang, 'job.media_more', { count }), [choice(lang, 'media:done', 'common.done')])]);
      }
      if (id === 'media:done') {
        if (Number(data.after) === 0) return again('job.need_photo');
        return logStep(ctx, 'job.voice', data);
      }
      return again();
    }
    case 'job.voice': {
      if (c.kind === 'media' && c.mediaType === 'audio') {
        if (c.durationSec && c.durationSec > media.maxVoiceSeconds) return again('job.voice_too_long');
        await ports.attachMedia({ jobId: data.jobId as string, kind: 'voice', providerMediaId: c.providerMediaId, mimeType: c.mimeType, ...(c.durationSec ? { durationSec: c.durationSec } : {}) });
        data.voice = true;
        return logStep(ctx, 'job.client_name', data);
      }
      if (id === 'voice:questions') return logStep(ctx, 'job.q1', data);
      if (txt && txt.length > 15) {
        data.notes = [txt];
        return logStep(ctx, 'job.client_name', data);
      }
      return again('job.need_voice');
    }
    case 'job.q1':
    case 'job.q2':
    case 'job.q3': {
      const next = session.step === 'job.q1' ? 'job.q2' : session.step === 'job.q2' ? 'job.q3' : 'job.client_name';
      if (c.kind === 'media' && c.mediaType === 'audio') {
        await ports.attachMedia({ jobId: data.jobId as string, kind: 'voice', providerMediaId: c.providerMediaId, mimeType: c.mimeType, ...(c.durationSec ? { durationSec: c.durationSec } : {}) });
        data.voice = true;
        return logStep(ctx, next, data);
      }
      if (txt) {
        data.notes = [...((data.notes as string[]) ?? []), `${t('en', session.step as MessageKey)} ${txt}`];
        return logStep(ctx, next, data);
      }
      return again();
    }
    case 'job.client_name': {
      if (!txt || txt.length < 2 || txt.length > 60) return again();
      data.clientName = txt.replace(/\s+/g, ' ');
      return logStep(ctx, 'job.client_phone', data);
    }
    case 'job.client_phone': {
      let raw: string | null = txt;
      if (c.kind === 'contact') {
        raw = c.phone;
        if (c.name && !data.clientName) data.clientName = c.name;
      }
      const phone = raw ? normalisePhone(raw) : null;
      if (!phone) return again('job.client_phone_invalid');
      const check = await ports.checkClientPhone({ artisanId: a.id, phone });
      if (check === 'own') return again('job.client_phone_own');
      if (check === 'registered') return again('job.client_phone_registered');
      if (check === 'blocked') return again('job.client_blocked');
      data.clientPhone = phone;
      return logStep(ctx, 'job.date', data);
    }
    case 'job.date': {
      const now = ports.now();
      if (id === 'date:today' || id === 'date:yesterday') {
        const d = new Date(now.getTime() - (id === 'date:yesterday' ? 86400000 : 0));
        data.jobDate = harareDateKey(d);
        data.areaId = a.areaId;
        data.areaName = a.areaName;
        return logStep(ctx, 'job.area', data);
      }
      if (id === 'date:other') return logStep(ctx, 'job.date_text', data);
      if (txt) {
        const key = parseDayMonth(txt, now);
        if (!key) return logStep(ctx, 'job.date_text', data, [say(lang, 'job.date_invalid')]);
        Object.assign(data, { jobDate: key, areaId: a.areaId, areaName: a.areaName });
        return logStep(ctx, 'job.area', data);
      }
      return again();
    }
    case 'job.date_text': {
      const key = txt ? parseDayMonth(txt, ports.now()) : null;
      if (!key) return again('job.date_invalid');
      Object.assign(data, { jobDate: key, areaId: a.areaId, areaName: a.areaName });
      return logStep(ctx, 'job.area', data);
    }
    case 'job.area':
      if (id === 'area:same') return logStep(ctx, 'job.location', data);
      if (id === 'area:other') return logStep(ctx, 'job.area_pick', data);
      return again();
    case 'job.area_pick': {
      const areas = await ports.listAreas(a.cityCode);
      const area = areas.find((x) => `jarea:${x.id}` === id);
      if (!area) return again();
      Object.assign(data, { areaId: area.id, areaName: area.name });
      return logStep(ctx, 'job.location', data);
    }
    case 'job.location':
      if (c.kind === 'location') {
        data.location = { lat: c.lat, lng: c.lng };
        return logStep(ctx, 'job.amount', data);
      }
      if (id === 'loc:skip') return logStep(ctx, 'job.amount', data);
      return again();
    case 'job.amount': {
      if (id === 'amount:skip') return logStep(ctx, 'job.summary', data);
      const m = txt?.replace(/^us\$|^\$|usd/i, '').trim();
      if (m && /^\d{1,6}(\.\d{1,2})?$/.test(m)) {
        data.amountCents = Math.round(Number(m) * 100);
        return logStep(ctx, 'job.summary', data);
      }
      return again('job.amount_invalid');
    }
    case 'job.summary': {
      if (id === 'job:restart') {
        if (data.jobId) await ports.discardDraftJob(data.jobId as string);
        return startLogJob({ ...ctx, session: { ...session, flow: null, data: {} } });
      }
      if (id !== 'job:submit') return again();
      const { ref } = await ports.submitJob(data.jobId as string, {
        clientName: data.clientName as string,
        clientPhone: data.clientPhone as string,
        jobDate: data.jobDate as string,
        areaId: data.areaId as string,
        location: (data.location as { lat: number; lng: number } | undefined) ?? null,
        amountCents: (data.amountCents as number | undefined) ?? null,
        notes: (data.notes as string[] | undefined) ?? [],
      });
      return done(ctx, [say(lang, 'job.submitted', { ref, client: data.clientName as string }), say(lang, 'common.menu_hint')]);
    }
    default:
      return startLogJob(ctx);
  }
}

// ======================================================================== waiting for clients

async function waiting(ctx: Ctx): Promise<FlowResult> {
  const { session, msg, ports, lang } = ctx;
  const id = choiceOf(msg);
  const data = { ...session.data };
  if (session.step === 'waiting.pick' && id?.startsWith('wj:')) {
    const jobs = await ports.listWaitingJobs(ctx.artisan!.id);
    const j = jobs.find((x) => x.jobId === id.slice(3));
    if (!j) return done(ctx, [say(lang, 'waiting.none')]);
    return go(ctx, 'waiting', 'waiting.item', { jobId: j.jobId, clientName: j.clientName }, [
      buttons(
        t(lang, 'waiting.item', {
          ref: j.ref,
          jobType: j.jobType[lang],
          client: j.clientName,
          date: j.sentAt ? formatDayMonthHarare(j.sentAt) : '—',
          reminders: j.remindersSent,
        }),
        [choice(lang, 'wa:remind', 'waiting.btn.remind'), choice(lang, 'wa:change', 'waiting.btn.change'), choice(lang, 'menu:menu', 'common.cancel')],
      ),
    ]);
  }
  if (session.step === 'waiting.item') {
    if (id === 'wa:remind') {
      const r = await ports.remindClient(data.jobId as string);
      return done(ctx, [r === 'sent' ? say(lang, 'waiting.reminded', { client: data.clientName as string }) : say(lang, 'waiting.remind_limit')]);
    }
    if (id === 'wa:change') return go(ctx, 'waiting', 'waiting.phone', data, [say(lang, 'waiting.change_prompt')]);
  }
  if (session.step === 'waiting.phone') {
    const raw = msg.content.kind === 'contact' ? msg.content.phone : textOf(msg);
    const phone = raw ? normalisePhone(raw) : null;
    if (!phone) return go(ctx, 'waiting', 'waiting.phone', data, [say(lang, 'job.client_phone_invalid')]);
    const r = await ports.changeClientPhone(data.jobId as string, phone);
    if (r === 'own') return go(ctx, 'waiting', 'waiting.phone', data, [say(lang, 'job.client_phone_own')]);
    if (r === 'registered') return go(ctx, 'waiting', 'waiting.phone', data, [say(lang, 'job.client_phone_registered')]);
    if (r === 'blocked') return go(ctx, 'waiting', 'waiting.phone', data, [say(lang, 'job.client_blocked')]);
    return done(ctx, [say(lang, 'waiting.changed')]);
  }
  return done(ctx, [mainMenu(lang, ctx.artisan!)]);
}

// ======================================================================== work requests

async function respondToRequest(ctx: Ctx, requestId: string, accept: boolean): Promise<FlowResult> {
  const res = await ctx.ports.respondWorkRequest({ artisanId: ctx.artisan!.id, requestId, accept });
  if (!res.ok) return done(ctx, [say(ctx.lang, 'wr.closed')]);
  if (!accept) return done(ctx, [say(ctx.lang, 'wr.declined')]);
  return done(ctx, [say(ctx.lang, 'wr.accepted', { contact: res.contactName ?? '', phone: res.contactPhone ?? '' })]);
}

async function workRequests(ctx: Ctx): Promise<FlowResult> {
  const { msg, ports, lang, session } = ctx;
  const id = choiceOf(msg);
  if (session.step === 'wr.pick' && id?.startsWith('wr:')) {
    const reqs = await ports.listOpenWorkRequests(ctx.artisan!.id);
    const r = reqs.find((x) => x.id === id.slice(3));
    if (!r) return done(ctx, [say(lang, 'wr.closed')]);
    return go(ctx, 'work_requests', 'wr.detail', { requestId: r.id }, [
      buttons(t(lang, 'wr.detail', { buyer: r.buyerName, area: r.area, dates: r.dates, description: r.description }), [
        choice(lang, `wr_accept:${r.id}`, 'tpl.btn.accept'),
        choice(lang, `wr_decline:${r.id}`, 'tpl.btn.decline'),
      ]),
    ]);
  }
  return done(ctx, [mainMenu(lang, ctx.artisan!)]);
}

// ======================================================================== help

function helpMenu(lang: Lang): OutboundMessage {
  return list(lang, t(lang, 'help.body'), [
    { id: 'help:faq', title: t(lang, 'help.faq') },
    { id: 'help:agent', title: t(lang, 'help.agent') },
    { id: 'help:report', title: t(lang, 'help.report') },
  ]);
}

async function help(ctx: Ctx): Promise<FlowResult> {
  const { msg, ports, lang, session } = ctx;
  const id = choiceOf(msg);
  const a = ctx.artisan!;
  if (id === 'help:faq') return done(ctx, [say(lang, 'help.faq_text'), say(lang, 'common.menu_hint')]);
  if (id === 'help:agent') {
    await ports.requestFieldAgent(a.id);
    return done(ctx, [say(lang, 'help.agent_text')]);
  }
  if (id === 'help:report') {
    const clients = await ports.listRecentClients(a.id);
    if (clients.length === 0) return done(ctx, [say(lang, 'help.report_none')]);
    return go(ctx, 'help', 'help.report_pick', {}, [list(lang, t(lang, 'help.report_pick'), clients.slice(0, 10).map((c) => ({ id: `rc:${c.id}`, title: c.name })))]);
  }
  if (session.step === 'help.report_pick' && id?.startsWith('rc:')) {
    return go(ctx, 'help', 'help.report_reason', { clientId: id.slice(3) }, [
      list(lang, t(lang, 'help.report_reason'), (['unsafe', 'harassment', 'nonpayment', 'other'] as const).map((r) => ({ id: `rr:${r}`, title: t(lang, `report.${r}`) }))),
    ]);
  }
  if (session.step === 'help.report_reason' && id?.startsWith('rr:')) {
    await ports.reportClient({ artisanId: a.id, clientId: session.data.clientId as string, reason: id.slice(3) });
    return done(ctx, [say(lang, 'help.reported')]);
  }
  return go(ctx, 'help', 'help.menu', {}, [helpMenu(lang)]);
}

// ======================================================================== settings

function settingsMenu(lang: Lang, a: ArtisanView): OutboundMessage {
  return list(lang, t(lang, 'settings.body'), [
    { id: 'set:language', title: t(lang, 'settings.language') },
    { id: 'set:name', title: t(lang, a.showFullName ? 'settings.show_short' : 'settings.show_full') },
    { id: 'set:delete', title: t(lang, 'settings.delete') },
  ]);
}

async function settings(ctx: Ctx): Promise<FlowResult> {
  const { msg, ports, lang } = ctx;
  const id = choiceOf(msg);
  const a = ctx.artisan!;
  if (id === 'set:language') {
    return go(ctx, 'settings', 'settings.language', {}, [
      buttons(t(lang, 'settings.language'), [
        { id: 'slang:en', title: t('en', 'lang.en') },
        { id: 'slang:sn', title: t('en', 'lang.sn') },
        { id: 'slang:nd', title: t('en', 'lang.nd') },
      ]),
    ]);
  }
  if (id?.startsWith('slang:')) {
    const l = id.slice(6) as Lang;
    await ports.updateArtisan(a.id, { lang: l });
    const r = done({ ...ctx, lang: l }, [say(l, 'settings.language_set'), mainMenu(l, { ...a, lang: l })]);
    r.session!.lang = l;
    return r;
  }
  if (id === 'set:name') {
    await ports.updateArtisan(a.id, { showFullName: !a.showFullName });
    return done(ctx, [say(lang, a.showFullName ? 'settings.name_short' : 'settings.name_full')]);
  }
  if (id === 'set:delete') {
    return go(ctx, 'settings', 'settings.delete', {}, [
      buttons(t(lang, 'settings.delete_confirm'), [choice(lang, 'del:yes', 'settings.btn.delete'), choice(lang, 'del:no', 'common.cancel')]),
    ]);
  }
  if (id === 'del:yes') {
    await ports.deleteArtisan(a.id);
    return { session: null, out: [say(lang, 'settings.deleted')] };
  }
  if (id === 'del:no') return done(ctx, [say(lang, 'common.cancelled')]);
  return go(ctx, 'settings', 'settings.menu', {}, [settingsMenu(lang, a)]);
}
