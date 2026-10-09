import type { Metadata } from 'next';
import { Badge, EmptyState, PageHeader, Panel, Stat, Table, TD, TH } from '@sp/ui';
import { fmtDate } from '@/lib/format';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'My reviews' };

type Mine = {
  name: string;
  trades: { code: string; name: string }[];
  reviewsThisMonth: number;
  reviewsTotal: number;
  endorsements: { id: string; artisan: { displayName: string; passportCode: string }; trade: string; statement: string; createdAt: string; withdrawnAt: string | null }[];
  recent: { id: string; ref: string; artisan: string; quality: string; createdAt: string }[];
};

const Q = { meets: { t: 'Meets the standard', tone: 'success' }, needs_improvement: { t: 'Needs improvement', tone: 'warning' }, reject: { t: 'Not accepted', tone: 'danger' } } as const;

export default async function HistoryPage() {
  const m = await api<Mine>('/reviews/mine');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Verifier" title="My reviews and endorsements" description={`${m.name} · ${m.trades.map((t) => t.name).join(', ')}`} />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={m.reviewsThisMonth} label="Reviews this month" hint="Paid per completed review" />
        <Stat value={m.reviewsTotal} label="Reviews in total" />
        <Stat value={m.endorsements.filter((e) => !e.withdrawnAt).length} label="Active endorsements" />
      </div>
      <Panel title="Endorsements">
        {m.endorsements.length ? (
          <ul className="divide-y divide-rule">
            {m.endorsements.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <a href={`/p/${e.artisan.passportCode}`} className="font-semibold text-ink-900 hover:underline">{e.artisan.displayName}</a>
                  <span className="text-muted">· {e.trade} · {fmtDate(e.createdAt)}</span>
                  {e.withdrawnAt ? <Badge tone="danger">Withdrawn</Badge> : null}
                </div>
                <p className="text-muted">“{e.statement}”</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4"><EmptyState title="No endorsements yet" body="After you review three of an artisan’s jobs as meeting the standard, you can endorse them from the review screen." /></div>
        )}
      </Panel>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Recent reviews</h2>
        {m.recent.length ? (
          <Table>
            <thead><tr><TH>Job</TH><TH>Artisan</TH><TH>Decision</TH><TH>Date</TH></tr></thead>
            <tbody>
              {m.recent.map((r) => (
                <tr key={r.id}>
                  <TD className="font-mono text-xs">{r.ref}</TD>
                  <TD>{r.artisan}</TD>
                  <TD><Badge tone={Q[r.quality as keyof typeof Q].tone}>{Q[r.quality as keyof typeof Q].t}</Badge></TD>
                  <TD className="text-muted">{fmtDate(r.createdAt)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No reviews yet" body="Your completed reviews appear here." />
        )}
      </section>
    </div>
  );
}
