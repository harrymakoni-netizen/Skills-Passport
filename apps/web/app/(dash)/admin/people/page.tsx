import type { Metadata } from 'next';
import { Badge, PageHeader, Table, TD, TH } from '@sp/ui';
import { AddStaff } from '@/components/admin/AddStaff';
import { fmtDate } from '@/lib/format';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Verifiers and agents' };

type Staff = {
  verifiers: { id: string; name: string; status: string; trades: string[]; area: string | null; yearsExperience: number; reviews: number; endorsements: number; conflicts: number; lastLoginAt: string | null }[];
  agents: { id: string; name: string; area: string | null; active: boolean; jobsLogged: number; enrolled: number; lastLoginAt: string | null }[];
};

export default async function PeoplePage() {
  const [s, ref] = await Promise.all([api<Staff>('/admin/staff'), api<{ trades: { id: string; code: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] }>('/public/reference')]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administrator" title="Verifiers and field agents" actions={<AddStaff trades={ref.trades} areas={ref.areas} />} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Verifiers</h2>
        <Table>
          <thead><tr><TH>Name</TH><TH>Trades</TH><TH>Area</TH><TH className="text-right">Experience</TH><TH className="text-right">Reviews</TH><TH className="text-right">Endorsements</TH><TH className="text-right">Conflicts</TH><TH>Last sign-in</TH></tr></thead>
          <tbody>
            {s.verifiers.map((v) => (
              <tr key={v.id}>
                <TD className="font-semibold">{v.name} {v.status !== 'active' ? <Badge tone="warning">{v.status}</Badge> : null}</TD>
                <TD className="font-mono text-xs">{v.trades.join(' · ')}</TD>
                <TD>{v.area ?? '—'}</TD>
                <TD className="text-right font-mono tabular">{v.yearsExperience} y</TD>
                <TD className="text-right font-mono tabular">{v.reviews}</TD>
                <TD className="text-right font-mono tabular">{v.endorsements}</TD>
                <TD className="text-right font-mono tabular">{v.conflicts}</TD>
                <TD className="text-muted">{v.lastLoginAt ? fmtDate(v.lastLoginAt) : 'Never'}</TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Field agents</h2>
        <Table>
          <thead><tr><TH>Name</TH><TH>Area</TH><TH className="text-right">Jobs logged</TH><TH className="text-right">Artisans enrolled</TH><TH>Last sign-in</TH></tr></thead>
          <tbody>
            {s.agents.map((a) => (
              <tr key={a.id}>
                <TD className="font-semibold">{a.name}</TD>
                <TD>{a.area ?? '—'}</TD>
                <TD className="text-right font-mono tabular">{a.jobsLogged}</TD>
                <TD className="text-right font-mono tabular">{a.enrolled}</TD>
                <TD className="text-muted">{a.lastLoginAt ? fmtDate(a.lastLoginAt) : 'Never'}</TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
