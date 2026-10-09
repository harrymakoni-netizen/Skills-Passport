import type { Metadata } from 'next';
import { Badge, EmptyState, PageHeader, Table, TD, TH } from '@sp/ui';
import { OutcomeButtons } from '@/components/buyer/OutcomeButtons';
import { fmtDate } from '@/lib/format';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'My work requests' };

type Row = { id: string; artisan: { displayName: string; passportCode: string; trade: string }; description: string; area: string; preferredDates: string; status: string; outcome: string; createdAt: string; artisanPhone: string | null };
const STATUS = { sent: { t: 'Waiting for the artisan', tone: 'warning' }, accepted: { t: 'Accepted', tone: 'success' }, declined: { t: 'Declined', tone: 'neutral' }, expired: { t: 'Expired', tone: 'neutral' } } as const;

export default async function RequestsPage() {
  const rows = await api<Row[]>('/work-requests');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Buyer" title="My work requests" description="Phone numbers appear only after the artisan accepts. After 14 days we ask both sides whether the job happened." />
      {rows.length ? (
        <Table>
          <thead><tr><TH>Artisan</TH><TH>Request</TH><TH>Status</TH><TH>Contact</TH><TH>Outcome</TH></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <TD><a href={`/p/${r.artisan.passportCode}`} className="font-semibold text-ink-900 hover:underline">{r.artisan.displayName}</a><div className="text-xs text-muted">{r.artisan.trade}</div></TD>
                <TD className="max-w-xs"><p className="line-clamp-2">{r.description}</p><p className="text-xs text-muted">{r.area} · {r.preferredDates} · sent {fmtDate(r.createdAt)}</p></TD>
                <TD><Badge tone={STATUS[r.status as keyof typeof STATUS].tone}>{STATUS[r.status as keyof typeof STATUS].t}</Badge></TD>
                <TD>{r.artisanPhone ? <a href={`tel:${r.artisanPhone}`} className="font-mono text-ink-900 underline underline-offset-4">{r.artisanPhone}</a> : <span className="text-muted">Hidden until accepted</span>}</TD>
                <TD>{r.status === 'accepted' ? <OutcomeButtons id={r.id} outcome={r.outcome} /> : <span className="text-muted">—</span>}</TD>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No requests yet" body="Find an artisan and send a request. They answer on WhatsApp." action={<a href="/buyer" className="text-sm font-semibold text-ink-900 underline underline-offset-4">Find artisans</a>} />
      )}
    </div>
  );
}
