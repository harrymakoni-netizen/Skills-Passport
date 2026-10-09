import type { Metadata } from 'next';
import { PageHeader, Panel, Stat } from '@sp/ui';
import { fmtDate } from '@/lib/format';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Pilot report' };

type Report = {
  range: { from: string; to: string };
  minimumCellSize: number;
  artisansEnrolled: { total: number | null; byTrade: Record<string, number | null>; byCity: Record<string, number | null>; byGender: Record<string, number | null>; byDisability: Record<string, number | null> };
  jobsLogged: { total: number | null; perActiveArtisanPerMonth: number | null };
  confirmationRate: number | null;
  disputeAndRejectionRate: number | null;
  timeToLevel: Record<string, number | null>;
  verifierTurnaroundHours: number | null;
  flagRate: number | null;
  flagsUpheldShare: number | null;
  workRequests: { sent: number | null; accepted: number | null; hired: number | null };
};

const v = (n: number | null, unit = '') => (n === null ? <span className="text-faint" title="Fewer than 5 — suppressed">&lt;5</span> : `${n}${unit}`);

function Breakdown({ title, data }: { title: string; data: Record<string, number | null> }) {
  const entries = Object.entries(data);
  return (
    <Panel title={title}>
      {entries.length ? (
        <ul className="divide-y divide-rule">
          {entries.map(([k, n]) => (
            <li key={k} className="flex justify-between px-4 py-2.5 text-sm"><span>{k.replace(/_/g, ' ')}</span><span className="font-mono tabular">{v(n)}</span></li>
          ))}
        </ul>
      ) : <p className="p-4 text-sm text-muted">No data (or not consented).</p>}
    </Panel>
  );
}

export default async function ReportPage() {
  const r = await api<Report>('/reports/pilot');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administrator" title="Pilot report" description={`${fmtDate(r.range.from)} – ${fmtDate(r.range.to)}. Aggregates only; any group smaller than ${r.minimumCellSize} is shown as <5. Gender and disability only where artisans consented.`} />
      <div className="grid grid-cols-2 gap-6 border-y border-rule py-5 md:grid-cols-4">
        <Stat value={v(r.artisansEnrolled.total)} label="Artisans enrolled" />
        <Stat value={v(r.jobsLogged.total)} label="Jobs logged" hint={r.jobsLogged.perActiveArtisanPerMonth !== null ? `${r.jobsLogged.perActiveArtisanPerMonth} per active artisan per month` : undefined} />
        <Stat value={v(r.confirmationRate, '%')} label="Confirmation rate" />
        <Stat value={v(r.disputeAndRejectionRate, '%')} label="Disputed or rejected" />
        <Stat value={v(r.verifierTurnaroundHours, ' h')} label="Median review turnaround" />
        <Stat value={v(r.flagRate, '%')} label="Jobs flagged" hint={r.flagsUpheldShare !== null ? `${r.flagsUpheldShare}% of resolved flags upheld` : undefined} />
        <Stat value={v(r.workRequests.sent)} label="Work requests sent" hint={`accepted ${r.workRequests.accepted ?? '<5'} · hired ${r.workRequests.hired ?? '<5'}`} />
        <Stat value={Object.keys(r.timeToLevel).length ? Object.entries(r.timeToLevel).map(([k, n]) => `${k} ${n ?? '<5'}d`).join(' · ') : '—'} label="Median days to level" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Breakdown title="By trade" data={r.artisansEnrolled.byTrade} />
        <Breakdown title="By city" data={r.artisansEnrolled.byCity} />
        <Breakdown title="By gender" data={r.artisansEnrolled.byGender} />
        <Breakdown title="By disability" data={r.artisansEnrolled.byDisability} />
      </div>
      <p className="text-sm text-muted">Income change and trade-test outcomes come from the month-12 survey and are not collected in the platform.</p>
    </div>
  );
}
