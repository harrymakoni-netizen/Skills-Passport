import type { Metadata } from 'next';
import { LevelBadge, PageHeader, Panel, Stat, Table, TD, TH, buttonClass } from '@sp/ui';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Overview' };

type Overview = { artisans: number; levels: Record<string, number>; awaiting: number; underReview: number; openFlags: number; agentTasks: number; jobs30: number };
type Staff = { verifierMonthly: { verifierId: string; name: string; month: string; reviews: number }[] };

export default async function AdminHome() {
  const [o, staff] = await Promise.all([api<Overview>('/admin/overview'), api<Staff>('/admin/staff')]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administrator" title="Overview" description="Operational counts for the pilot. Published figures use the pilot report, which suppresses small groups." actions={<a href="/admin/flags" className={buttonClass('primary', 'sm')}>Review {o.openFlags} open flags</a>} />
      <div className="grid grid-cols-2 gap-6 border-y border-rule py-5 md:grid-cols-6">
        <Stat value={o.artisans} label="Artisans" />
        <Stat value={o.jobs30} label="Jobs, last 30 days" />
        <Stat value={o.awaiting} label="Waiting for clients" />
        <Stat value={o.underReview} label="Waiting for review" />
        <Stat value={o.openFlags} label="Open fraud flags" />
        <Stat value={o.agentTasks} label="Agent follow-ups" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Artisans by level">
          <ul className="divide-y divide-rule">
            {(['gold', 'silver', 'bronze', 'starter'] as const).map((l) => (
              <li key={l} className="flex items-center justify-between px-4 py-3">
                <LevelBadge level={l} label={l} size="sm" />
                <span className="font-mono tabular">{o.levels[l] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Reviews per verifier per month">
          {staff.verifierMonthly.length ? (
            <Table className="rounded-none border-0">
              <thead><tr><TH>Month</TH><TH>Verifier</TH><TH className="text-right">Reviews</TH></tr></thead>
              <tbody>
                {staff.verifierMonthly.map((r) => (
                  <tr key={`${r.verifierId}-${r.month}`}><TD className="font-mono text-xs">{r.month}</TD><TD>{r.name}</TD><TD className="text-right font-mono tabular">{r.reviews}</TD></tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="p-4 text-sm text-muted">No reviews yet.</p>}
        </Panel>
      </div>
    </div>
  );
}
