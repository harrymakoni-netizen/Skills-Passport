import { t } from '@sp/core';
import { LevelBadge, PassportHeader, buttonClass, type Level } from '@sp/ui';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { site } from '@/lib/copy';
import { fmtMonth } from '@/lib/format';
import { publicApi } from '@/lib/server';
import type { PublicPassport } from '@/lib/types';

const EXAMPLE = 'SP-HRE-00001';

export default async function Home() {
  const [example, ref] = await Promise.all([
    publicApi<PublicPassport>(`/public/passports/${EXAMPLE}`, 60).catch(() => null),
    publicApi<{ trades: { id: string; code: string; name: { en: string } }[] }>('/public/reference', 300).catch(() => null),
  ]);
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-14 md:px-6 md:pt-16">
          <div className="flex flex-col gap-6">
            <p className="smallcaps text-accent">{site.hero.eyebrow}</p>
            <h1 className="font-display text-display font-semibold tracking-[-0.02em] text-ink-950">{site.hero.title}</h1>
            <p className="max-w-xl text-base leading-7 text-muted">{site.hero.body}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/p/${EXAMPLE}`} className={buttonClass('primary', 'lg')}>
                {site.hero.primary}
              </a>
              <a href="/find" className={buttonClass('secondary', 'lg')}>
                {site.hero.secondary}
              </a>
            </div>
            <p className="text-sm text-muted">{site.hero.note}</p>
          </div>
          {example ? (
            <a href={`/p/${example.code}`} className="group flex flex-col gap-3 self-start" aria-label={`${example.displayName}'s passport`}>
              <PassportHeader
                label="Skills Passport"
                name={example.displayName}
                meta={
                  <span>
                    <span className="font-semibold text-paper">{example.trades[0]?.name.en}</span> · {example.area}, {example.city}
                  </span>
                }
                level={example.level}
                levelLabel={t('en', `level.${example.level}`)}
                code={example.code}
                codeLabel="Passport no."
                footer={<span>Member since {fmtMonth(example.memberSince)}</span>}
              />
              <div className="grid grid-cols-3 gap-2">
                {example.gallery.slice(0, 3).map((g) => (
                  <img key={g.id} src={g.thumb} alt={g.jobType.en} loading="lazy" className="aspect-square w-full rounded-md border border-rule object-cover transition-transform duration-200 group-hover:scale-[1.01]" />
                ))}
              </div>
              <div className="grid grid-cols-3 divide-x divide-rule border-y border-rule text-sm">
                <span className="flex flex-col py-2 pr-3">
                  <span className="font-mono text-lg tabular">{example.stats.countedJobs}</span>
                  <span className="text-muted">Confirmed jobs</span>
                </span>
                <span className="flex flex-col px-3 py-2">
                  <span className="font-mono text-lg tabular">{example.stats.distinctClients}</span>
                  <span className="text-muted">Clients served</span>
                </span>
                <span className="flex flex-col px-3 py-2">
                  <span className="font-mono text-lg tabular">{example.stats.averageRating?.toFixed(1) ?? '—'}</span>
                  <span className="text-muted">Average rating</span>
                </span>
              </div>
            </a>
          ) : null}
        </section>

        <section id="how" className="border-y border-rule bg-raised">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <h2 className="font-display text-xl font-semibold">{site.how.title}</h2>
            <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-4">
              {site.how.steps.map((s) => (
                <li key={s.n} className="flex flex-col gap-3 bg-raised p-5">
                  <span className="font-mono text-sm text-accent">{s.n}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm leading-6 text-muted">{s.body}</p>
                  <p className="mt-auto rounded-md bg-[#efeae2] px-3 py-2 text-sm leading-5 text-[#111b21]">{s.quote}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="levels" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">{site.levels.title}</h2>
              <p className="text-muted">{site.levels.body}</p>
            </div>
            <ul className="divide-y divide-rule border-y border-rule">
              {site.levels.rows.map((r) => (
                <li key={r.level} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    <LevelBadge level={r.level as Level} label={t('en', `level.${r.level}`)} size="sm" />
                    <span className="text-xs text-muted">{r.shown}</span>
                  </div>
                  <p className="text-sm leading-6">{r.req}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-rule bg-ink-900 text-paper">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <h2 className="font-display text-xl font-semibold">{site.honest.title}</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-4">
              {site.honest.items.map((i) => (
                <div key={i.title} className="flex flex-col gap-2 border-t border-ink-300/30 pt-4">
                  <h3 className="font-semibold">{i.title}</h3>
                  <p className="text-sm leading-6 text-ink-100">{i.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">{site.trades.title}</h2>
              <p className="text-muted">{site.trades.body}</p>
            </div>
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-3">
              {(ref?.trades ?? []).map((tr) => (
                <li key={tr.id} className="flex min-h-20 flex-col justify-between gap-2 bg-raised p-4">
                  <span className="font-mono text-xs text-muted">{tr.code}</span>
                  <a href={`/find?trade=${tr.code}`} className="font-semibold text-ink-900 hover:underline">
                    {tr.name.en}
                  </a>
                </li>
              ))}
              <li className="flex min-h-20 flex-col justify-between gap-2 bg-paper p-4 text-sm text-muted">More trades join after the pilot, with frameworks agreed with master artisans.</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
