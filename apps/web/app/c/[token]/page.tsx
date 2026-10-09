import type { Metadata } from 'next';
import { isLang, tw, type Lang } from '@sp/core';
import { ConfirmForm } from '@/components/confirm/ConfirmForm';
import { LangSwitch } from '@/components/passport/LangSwitch';
import { fmtDate } from '@/lib/format';
import { publicApi } from '@/lib/server';
import type { Localized } from '@/lib/types';

export const metadata: Metadata = { title: 'Confirm a job', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type PageData =
  | { state: 'invalid' }
  | {
      state: 'open' | 'rate' | 'used' | 'expired';
      lang: Lang;
      artisan: { displayName: string; firstName: string; passportCode: string; public: boolean };
      job: { ref: string; jobType: Localized; date: string; area: string | null; summary: string | null; photos: { id: string; url: string; thumb: string | null; kind: string }[] };
      response: string | null;
      rating: number | null;
    };

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const data = (await publicApi<PageData>(`/public/confirmations/${encodeURIComponent(token)}`, 0).catch(() => null)) ?? { state: 'invalid' as const };
  const lang: Lang = isLang(sp.lang) ? sp.lang : data.state !== 'invalid' ? data.lang : 'en';
  const T = (k: Parameters<typeof tw>[1], p?: Record<string, string | number>) => tw(lang, k, p);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-10 pt-3">
      <header className="flex items-center justify-between gap-2 border-b border-rule pb-3">
        <span className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-900">
          <img src="/icon.svg" alt="" width={24} height={24} className="size-6" />
          {T('brand.name')}
        </span>
        <LangSwitch current={lang} base={`/c/${token}`} label={T('lang.switch')} />
      </header>

      {data.state === 'invalid' || data.state === 'expired' || data.state === 'used' ? (
        <section className="flex flex-1 flex-col justify-center gap-3 py-16">
          <h1 className="font-display text-xl font-semibold">{T(data.state === 'invalid' ? 'c.invalid_title' : data.state === 'expired' ? 'c.expired_title' : 'c.used_title')}</h1>
          <p className="text-muted">{T(data.state === 'invalid' ? 'c.invalid_body' : data.state === 'expired' ? 'c.expired_body' : 'c.used_body')}</p>
          {data.state !== 'invalid' && data.artisan.public ? (
            <a href={`/p/${data.artisan.passportCode}${lang === 'en' ? '' : `?lang=${lang}`}`} className="mt-2 inline-flex min-h-11 items-center font-semibold text-ink-900 underline decoration-accent decoration-2 underline-offset-4">
              {T('c.view_passport', { name: data.artisan.firstName })}
            </a>
          ) : null}
        </section>
      ) : (
        <main className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-2">
            <p className="smallcaps text-muted">{T('c.title')}</p>
            <h1 className="font-display text-xl font-semibold leading-tight">{data.job.jobType[lang]}</h1>
            <p className="text-base text-text">{T('c.lead', { name: data.artisan.displayName })}</p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule text-sm">
            <div className="bg-raised px-4 py-3">
              <dt className="text-muted">{T('c.job_date')}</dt>
              <dd className="font-semibold">{fmtDate(data.job.date)}</dd>
            </div>
            <div className="bg-raised px-4 py-3">
              <dt className="text-muted">{T('c.area')}</dt>
              <dd className="font-semibold">{data.job.area ?? '—'}</dd>
            </div>
            <div className="col-span-2 bg-raised px-4 py-3">
              <dt className="text-muted">{T('p.passport_no')}</dt>
              <dd className="serial text-sm">{data.artisan.passportCode}</dd>
            </div>
          </dl>

          {data.job.photos.length ? (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
              {data.job.photos.map((p) => (
                <li key={p.id} className="w-[78%] shrink-0 snap-start sm:w-[48%]">
                  <img src={p.url} alt={data.job.jobType[lang]} loading="lazy" className="aspect-[4/3] w-full rounded-md border border-rule bg-sunk object-cover" />
                </li>
              ))}
            </ul>
          ) : null}

          {data.job.summary ? <p className="border-l-2 border-rule-strong pl-3 text-sm leading-6 text-muted">{data.job.summary}</p> : null}

          <ConfirmForm
            token={token}
            mode={data.state === 'rate' ? 'rate' : 'confirm'}
            passportHref={data.artisan.public ? `/p/${data.artisan.passportCode}${lang === 'en' ? '' : `?lang=${lang}`}` : null}
            labels={{
              question: T('c.question'),
              yes: T('c.yes'),
              no: T('c.no'),
              rate: T('c.rate'),
              rateHelp: T('c.rate_help'),
              star: [1, 2, 3, 4, 5].map((n) => T('c.star', { n })),
              comment: T('c.comment'),
              commentHint: T('c.comment_hint'),
              submit: T('c.submit'),
              submitting: T('c.submitting'),
              doneTitle: T('c.done_title'),
              doneYes: T('c.done_yes', { name: data.artisan.firstName }),
              doneNo: T('c.done_no'),
              viewPassport: T('c.view_passport', { name: data.artisan.firstName }),
              alreadyConfirmed: T('c.already_confirmed_rate'),
              error: T('c.error'),
              chooseRating: T('c.choose_rating'),
              stop: T('c.stop'),
              stopped: T('c.stopped'),
            }}
          />

          <footer className="mt-4 flex flex-col gap-1 border-t border-rule pt-4 text-xs text-muted">
            <p>{T('c.privacy')}</p>
          </footer>
        </main>
      )}
    </div>
  );
}
