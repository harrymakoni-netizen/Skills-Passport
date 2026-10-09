import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLang, isPassportCode, t, tw, type Lang } from '@sp/core';
import { LevelBadge, PassportHeader, Seal, cx } from '@sp/ui';
import { Gallery } from '@/components/passport/Gallery';
import { LangSwitch } from '@/components/passport/LangSwitch';
import { ShareBar } from '@/components/passport/ShareBar';
import { fmtDate, fmtMonth, initials } from '@/lib/format';
import { publicApi } from '@/lib/server';
import type { PublicPassport } from '@/lib/types';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ lang?: string }> };

async function load(code: string) {
  if (!isPassportCode(code)) return null;
  return publicApi<PublicPassport>(`/public/passports/${code}?view=1`, 30);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const p = await load(code).catch(() => null);
  if (!p) return { title: 'Passport not found', robots: { index: false } };
  const trade = p.trades.map((t) => t.name.en).join(' · ');
  const title = `${p.displayName} — ${trade}`;
  const description = `${p.stats.countedJobs} confirmed jobs for ${p.stats.distinctClients} clients in ${p.area}, ${p.city}. Skills Passport ${p.code}.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.code}` },
    openGraph: { title, description, url: `/p/${p.code}`, type: 'profile', images: [{ url: `/p/${p.code}/og.png`, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [`/p/${p.code}/og.png`] },
  };
}

const LEVEL_KEYS = { starter: 'level.shown.starter', bronze: 'level.shown.bronze', silver: 'level.shown.silver', gold: 'level.shown.gold' } as const;

export default async function PassportPage({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const lang: Lang = isLang(sp.lang) ? sp.lang : 'en';
  const p = await load(code);
  if (!p) notFound();
  const T = (k: Parameters<typeof tw>[1], params?: Record<string, string | number>) => tw(lang, k, params);
  const tradeLine = p.trades.length > 1 ? T('p.trades_and', { a: p.trades[0]!.name[lang], b: p.trades[1]!.name[lang] }) : p.trades[0]?.name[lang];
  const levelName = t(lang, `level.${p.level}`);
  const shareText = `${p.displayName} · ${tradeLine} · ${p.url}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-16 pt-3 md:px-6 md:pt-6">
      <div className="flex items-center justify-between gap-2">
        <a href="/" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-900">
          <img src="/icon.svg" alt="" width={24} height={24} className="size-6" />
          {T('brand.name')}
        </a>
        <LangSwitch current={lang} base={`/p/${p.code}`} label={T('lang.switch')} />
      </div>

      <PassportHeader
        label={T('brand.document_label')}
        name={p.displayName}
        photoUrl={p.profilePhotoUrl}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-paper">{tradeLine}</span>
            <span aria-hidden className="text-ink-300">·</span>
            <span>
              {p.area}, {p.city}
            </span>
            {p.badges.includes('women_in_trades') ? <span className="rounded-sm border border-ink-300/50 px-1.5 py-0.5 text-xs font-semibold text-ink-100">{T('p.badge.women_in_trades')}</span> : null}
          </span>
        }
        level={p.level}
        levelLabel={levelName}
        levelCaption={t(lang, LEVEL_KEYS[p.level])}
        code={p.code}
        codeLabel={T('p.passport_no')}
        footer={
          <span>
            {T('p.member_since')} <span className="text-paper">{fmtMonth(p.memberSince)}</span>
            {p.experienceYears ? <span className="ml-3">{T('p.years_experience', { n: p.experienceYears })}</span> : null}
          </span>
        }
      />

      {/* Figures: what buyers check first. */}
      <section aria-label={T('p.verified_jobs')} className="grid grid-cols-3 divide-x divide-rule border-y border-rule">
        {[
          { v: p.stats.countedJobs, l: T('p.verified_jobs') },
          { v: p.stats.distinctClients, l: T('p.clients_served') },
          { v: p.stats.averageRating !== null ? p.stats.averageRating.toFixed(1) : '—', l: T('p.average_rating'), h: p.stats.ratingsCount ? T('p.ratings_count', { n: p.stats.ratingsCount }) : T('p.no_rating') },
        ].map((s) => (
          <div key={s.l} className="flex flex-col gap-1 px-3 py-4 first:pl-0 md:px-6 md:first:pl-0">
            <span className="font-mono text-xl font-medium tabular text-text md:text-display md:leading-none">{s.v}</span>
            <span className="text-sm text-muted">{s.l}</span>
            {s.h ? <span className="text-xs text-faint">{s.h}</span> : null}
          </div>
        ))}
      </section>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-12">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="work" className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="work" className="font-display text-lg font-semibold">
                {T('p.work')}
              </h2>
              <p className="text-sm text-muted">{T('p.work_intro')}</p>
            </div>
            {p.gallery.length ? (
              <Gallery
                items={p.gallery.map((g) => ({ id: g.id, url: g.url, thumb: g.thumb, width: g.width, height: g.height, caption: T('p.job_month', { jobType: g.jobType[lang], month: fmtMonth(g.month) }), badge: g.reviewed ? T('p.reviewed') : undefined }))}
                labels={{ close: T('p.close'), prev: T('p.prev'), next: T('p.next') }}
              />
            ) : (
              <p className="rounded-md border border-dashed border-rule-strong px-4 py-6 text-sm text-muted">{T('p.work_empty')}</p>
            )}
          </section>

          <section aria-labelledby="skills" className="flex flex-col gap-4">
            <h2 id="skills" className="font-display text-lg font-semibold">
              {T('p.competencies')}
            </h2>
            {p.competencies.map((c) => (
              <div key={c.tradeId} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <p className="text-muted">{T('p.competencies_intro', { trade: c.tradeName[lang] })}</p>
                  <p className="shrink-0 font-mono tabular text-text">{T('p.units_verified', { n: c.verified, total: c.total })}</p>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-sunk" aria-hidden>
                  <div className="h-full bg-ink-700" style={{ width: `${c.total ? (c.verified / c.total) * 100 : 0}%` }} />
                </div>
                <ul className="divide-y divide-rule border-y border-rule">
                  {c.units.map((u) => (
                    <li key={u.code} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="w-14 shrink-0 font-mono text-xs tabular text-muted">{u.code}</span>
                      <span className={cx('flex-1 text-sm', u.status === 'none' ? 'text-muted' : 'text-text')}>{u.title[lang]}</span>
                      {u.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                          {T('p.unit_verified')}
                        </span>
                      ) : u.status === 'pending' ? (
                        <span className="text-xs font-semibold text-warning">{T('p.unit_pending')}</span>
                      ) : (
                        <span className="text-xs text-faint">{T('p.unit_none')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>

        <aside className="flex flex-col gap-10">
          <section aria-labelledby="endorsed" className="flex flex-col gap-4">
            <h2 id="endorsed" className="font-display text-lg font-semibold">
              {T('p.endorsed_by')}
            </h2>
            {p.endorsements.length ? (
              <ul className="flex flex-col gap-4">
                {p.endorsements.map((e) => (
                  <li key={e.id} className="flex gap-4 rounded-lg border border-rule bg-raised p-4">
                    <Seal initials={initials(e.verifierName)} size={60} title={`${e.verifierName}`} />
                    <div className="flex flex-col gap-2">
                      <blockquote className="text-sm leading-6 text-text">“{e.statement}”</blockquote>
                      <p className="text-sm">
                        <span className="font-semibold">{e.verifierName}</span>
                        <span className="text-muted"> · {T('p.master_artisan', { trade: e.tradeName[lang] })}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {T('p.years_experience', { n: e.yearsExperience })} · {fmtDate(e.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{T('p.endorsement_empty')}</p>
            )}
          </section>

          <section aria-labelledby="share" className="flex flex-col gap-4 border-t border-rule pt-6">
            <h2 id="share" className="smallcaps text-muted">
              {T('p.share')}
            </h2>
            <div className="flex items-center gap-4">
              <img src={`/p/${p.code}/qr.png`} alt={T('p.scan')} width={112} height={128} loading="lazy" className="h-32 w-28 rounded-sm border border-rule bg-paper object-contain p-1" />
              <p className="text-sm text-muted">{T('p.scan')}</p>
            </div>
            <ShareBar url={p.url} text={shareText} labels={{ whatsapp: T('p.share_whatsapp'), copy: T('p.copy_link'), copied: T('p.copied') }} />
          </section>

          <section aria-labelledby="how" className="flex flex-col gap-2 border-t border-rule pt-6">
            <h2 id="how" className="text-sm font-semibold">
              {T('p.how_checked_title')}
            </h2>
            <p className="text-sm leading-6 text-muted">{T('p.how_checked_body')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <LevelBadge level={p.level} label={levelName} size="sm" />
              <span>{t(lang, LEVEL_KEYS[p.level])}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
