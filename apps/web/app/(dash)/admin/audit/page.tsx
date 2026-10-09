import type { Metadata } from 'next';
import { EmptyState, PageHeader, Table, TD, TH } from '@sp/ui';
import { fmtDateTime } from '@/lib/format';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Audit log' };
type Row = { id: string; action: string; entity: string; entityId: string | null; at: string; details: unknown; actor: { name: string; role: string } | null };

export default async function AuditPage() {
  const rows = await api<Row[]>('/admin/audit');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administrator" title="Audit log" description="Admin actions, sign-ins, endorsements and access to personal data. The latest 300 entries." />
      {rows.length ? (
        <Table>
          <thead><tr><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Record</TH><TH>Details</TH></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <TD className="whitespace-nowrap font-mono text-xs">{fmtDateTime(r.at)}</TD>
                <TD>{r.actor ? <>{r.actor.name} <span className="text-xs text-muted">{r.actor.role}</span></> : <span className="text-muted">System</span>}</TD>
                <TD className="font-mono text-xs">{r.action}</TD>
                <TD className="font-mono text-xs text-muted">{r.entity}{r.entityId ? ` · ${r.entityId.slice(-8)}` : ''}</TD>
                <TD className="max-w-xs truncate font-mono text-xs text-muted">{r.details ? JSON.stringify(r.details) : ''}</TD>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No entries yet" />
      )}
    </div>
  );
}
