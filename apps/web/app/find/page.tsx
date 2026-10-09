import type { Metadata } from 'next';
import { EmptyState, buttonClass } from '@sp/ui';
import { Filters } from '@/components/directory/Filters';
import { Results, type DirectoryItem } from '@/components/directory/Results';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { publicApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Find an artisan', description: 'Search verified artisans by trade, area, level and rating.' };

type Ref = { trades: { code: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] };

export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1] && ['trade', 'area', 'level', 'minRating', 'page'].includes(e[0])));
  const [ref, res] = await Promise.all([publicApi<Ref>('/public/reference', 300), publicApi<{ total: number; page: number; pageSize: number; items: DirectoryItem[] }>(`/public/directory?${qs}`, 30)]);
  const page = res?.page ?? 1;
  const pages = res ? Math.max(1, Math.ceil(res.total / res.pageSize)) : 1;
  const link = (p: number) => `/find?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(p) })}`;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-xl font-semibold">Find an artisan</h1>
          <p className="max-w-2xl text-muted">Every artisan here has jobs confirmed by real clients. Sorted by level, then rating, then recent work. To send a work request, sign in as a buyer.</p>
        </div>
        <Filters action="/find" trades={ref?.trades ?? []} areas={ref?.areas ?? []} value={sp} />
        <p className="text-sm text-muted" aria-live="polite">
          <span className="font-mono tabular text-text">{res?.total ?? 0}</span> artisans
        </p>
        {res && res.items.length ? (
          <Results items={res.items} action={(a) => <a href={`/p/${a.code}`} className={buttonClass('secondary', 'sm')}>View passport</a>} />
        ) : (
          <EmptyState title="No artisans match these filters" body="Try a different area or a lower level. New artisans join every week." action={<a href="/find" className={buttonClass('secondary', 'sm')}>Clear filters</a>} />
        )}
        {pages > 1 ? (
          <nav className="flex items-center gap-2 text-sm" aria-label="Pages">
            {page > 1 ? <a href={link(page - 1)} className={buttonClass('secondary', 'sm')}>Previous</a> : null}
            <span className="tabular text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? <a href={link(page + 1)} className={buttonClass('secondary', 'sm')}>Next</a> : null}
          </nav>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
