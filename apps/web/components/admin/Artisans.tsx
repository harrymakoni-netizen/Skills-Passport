'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Input, LevelBadge, PageHeader, Skeleton, Table, TD, TH, type Level } from '@sp/ui';
import { useToast } from '@sp/ui/client';
import { call } from '@/lib/client';
import { fmtDate } from '@/lib/format';

type Row = { id: string; passportCode: string; displayName: string; level: Level; status: string; levelFrozen: boolean; trustScore: number; area: string; city: string; trades: string[]; jobs: number; joinedAt: string };
type Key = 'passportCode' | 'displayName' | 'level' | 'trustScore' | 'jobs' | 'joinedAt';
const ORDER: Record<Level, number> = { starter: 0, bronze: 1, silver: 2, gold: 3 };

export function Artisans() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: Key; dir: 'asc' | 'desc' }>({ key: 'joinedAt', dir: 'desc' });
  const load = () => call<Row[]>('/admin/artisans').then(setRows).catch((e) => toast((e as Error).message, 'danger'));
  useEffect(() => void load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !term || r.displayName.toLowerCase().includes(term) || r.passportCode.toLowerCase().includes(term) || r.area.toLowerCase().includes(term));
    const val = (r: Row) => (sort.key === 'level' ? ORDER[r.level] : r[sort.key]);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  }, [rows, q, sort]);
  const th = (key: Key, label: string, className?: string) => (
    <TH className={className} sort={sort.key === key ? sort.dir : null} onSort={() => setSort({ key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' })}>
      {label}
    </TH>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administrator" title="Artisans" description="Trust score is internal and never shown publicly." />
      <Input placeholder="Search by name, passport number or area" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" aria-label="Search artisans" />
      {rows === null ? (
        <Skeleton className="h-64" />
      ) : view.length === 0 ? (
        <EmptyState title="No artisans found" />
      ) : (
        <Table>
          <thead>
            <tr>
              {th('passportCode', 'Passport')}
              {th('displayName', 'Name')}
              <TH>Trade · area</TH>
              {th('level', 'Level')}
              {th('jobs', 'Jobs', 'text-right')}
              {th('trustScore', 'Trust', 'text-right')}
              {th('joinedAt', 'Joined')}
              <TH />
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className="hover:bg-paper">
                <TD className="font-mono text-xs"><a href={`/p/${r.passportCode}`} target="_blank" rel="noreferrer" className="hover:underline">{r.passportCode}</a></TD>
                <TD className="font-semibold">{r.displayName}</TD>
                <TD className="text-muted">{r.trades.join(', ')} · {r.area}</TD>
                <TD><span className="flex items-center gap-2"><LevelBadge level={r.level} label={r.level} size="sm" />{r.levelFrozen ? <Badge tone="danger">Frozen</Badge> : null}</span></TD>
                <TD className="text-right font-mono tabular">{r.jobs}</TD>
                <TD className={`text-right font-mono tabular ${r.trustScore < 60 ? 'text-danger' : ''}`}>{r.trustScore}</TD>
                <TD className="text-muted">{fmtDate(r.joinedAt)}</TD>
                <TD className="text-right">
                  <Button
                    size="sm"
                    variant={r.levelFrozen ? 'secondary' : 'ghost'}
                    onClick={async () => {
                      await call(`/admin/artisans/${r.id}/freeze`, { body: { frozen: !r.levelFrozen } });
                      toast(r.levelFrozen ? 'Unfrozen' : 'Level frozen', 'success');
                      void load();
                    }}
                  >
                    {r.levelFrozen ? 'Unfreeze' : 'Freeze'}
                  </Button>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
