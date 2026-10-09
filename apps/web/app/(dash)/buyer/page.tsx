import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@sp/ui';
import { RequestButton } from '@/components/buyer/RequestButton';
import { Filters } from '@/components/directory/Filters';
import { Results, type DirectoryItem } from '@/components/directory/Results';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Find artisans' };

export default async function BuyerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1]));
  const [ref, res] = await Promise.all([
    api<{ trades: { code: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] }>('/public/reference'),
    api<{ total: number; items: DirectoryItem[] }>(`/directory?${qs}`),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Buyer" title="Find artisans" description="Send a work request. The artisan accepts or declines on WhatsApp; you get their phone number only after they accept." />
      <Filters action="/buyer" trades={ref.trades} areas={ref.areas} value={sp} />
      <p className="text-sm text-muted"><span className="font-mono text-text tabular">{res.total}</span> artisans</p>
      {res.items.length ? (
        <Results items={res.items} action={(a) => <RequestButton code={a.code} name={a.displayName} areas={ref.areas} />} />
      ) : (
        <EmptyState title="No artisans match these filters" body="Try a nearby area or a lower level." />
      )}
    </div>
  );
}
