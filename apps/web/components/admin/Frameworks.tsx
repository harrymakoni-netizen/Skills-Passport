'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, PageHeader, Skeleton, Table, TD, TH, Textarea } from '@sp/ui';
import { Dialog, Tabs, useToast } from '@sp/ui/client';
import { call } from '@/lib/client';

type Unit = { id: string; code: string; title: { en: string; sn: string; nd: string }; description: string; evidenceGuidance: string; classLevel: string | null; standardRef: string | null; active: boolean };
type JobType = { id: string; key: string; name: { en: string }; needsBeforePhoto: boolean; active: boolean; units: { unit: { code: string } }[] };
type Trade = { id: string; code: string; nameEn: string; active: boolean; units: Unit[]; jobTypes: JobType[] };

/** The framework is data, not code (SPEC 7): admins edit units and job types here. */
export function Frameworks() {
  const toast = useToast();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [tab, setTab] = useState('');
  const [edit, setEdit] = useState<Unit | 'new' | null>(null);
  const [form, setForm] = useState({ code: '', title: '', titleSn: '', titleNd: '', description: '', evidenceGuidance: '', standardRef: '', classLevel: '' });
  const load = () =>
    call<Trade[]>('/admin/trades').then((t) => {
      setTrades(t);
      setTab((cur) => cur || t[0]?.id || '');
    });
  useEffect(() => void load(), []);  
  const trade = trades?.find((t) => t.id === tab);

  const open = (u: Unit | 'new') => {
    setEdit(u);
    setForm(u === 'new' ? { code: `${trade?.code}-`, title: '', titleSn: '', titleNd: '', description: '', evidenceGuidance: '', standardRef: '', classLevel: '' } : { code: u.code, title: u.title.en, titleSn: u.title.sn, titleNd: u.title.nd, description: u.description, evidenceGuidance: u.evidenceGuidance, standardRef: u.standardRef ?? '', classLevel: u.classLevel ?? '' });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administrator" title="Competency frameworks" description="Draft units — finalise each with at least two master artisans per trade and map them to the official unit standards before launch." actions={trade ? <Button size="sm" onClick={() => open('new')}>Add unit</Button> : null} />
      {trades === null ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Tabs label="Trades" value={tab} onChange={setTab} tabs={trades.map((t) => ({ id: t.id, label: t.nameEn, count: t.units.length }))} />
          {trade ? (
            <div className="flex flex-col gap-8">
              <Table>
                <thead><tr><TH>Code</TH><TH>Unit</TH><TH>Evidence guidance</TH><TH>Standard</TH><TH /></tr></thead>
                <tbody>
                  {trade.units.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                      <TD className="font-mono text-xs">{u.code}</TD>
                      <TD><span className="font-semibold">{u.title.en}</span><p className="text-xs text-muted">{u.description}</p></TD>
                      <TD className="max-w-xs text-muted">{u.evidenceGuidance}</TD>
                      <TD>{u.standardRef ? <span className="font-mono text-xs">{u.standardRef}</span> : <Badge tone="warning">To map</Badge>}</TD>
                      <TD className="whitespace-nowrap text-right">
                        <Button size="sm" variant="ghost" onClick={() => open(u)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await call(`/admin/units/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); void load(); }}>{u.active ? 'Retire' : 'Restore'}</Button>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold">Job types</h2>
                <Table>
                  <thead><tr><TH>Job type</TH><TH>Before photo</TH><TH>Units usually evidenced</TH><TH /></tr></thead>
                  <tbody>
                    {trade.jobTypes.map((j) => (
                      <tr key={j.id} className={j.active ? '' : 'opacity-50'}>
                        <TD><span className="font-semibold">{j.name.en}</span><p className="font-mono text-xs text-muted">{j.key}</p></TD>
                        <TD>{j.needsBeforePhoto ? 'Required' : 'Optional'}</TD>
                        <TD className="font-mono text-xs text-muted">{j.units.map((u) => u.unit.code).join(' · ')}</TD>
                        <TD className="text-right">
                          <Button size="sm" variant="ghost" onClick={async () => { await call(`/admin/job-types/${j.id}`, { method: 'PATCH', body: { needsBeforePhoto: !j.needsBeforePhoto } }); void load(); }}>
                            {j.needsBeforePhoto ? 'Make before photo optional' : 'Require before photo'}
                          </Button>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            </div>
          ) : null}
        </>
      )}
      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        wide
        title={edit === 'new' ? `New unit · ${trade?.nameEn}` : `Edit ${edit ? edit.code : ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  const body = { title: { en: form.title, sn: form.titleSn || undefined, nd: form.titleNd || undefined }, description: form.description, evidenceGuidance: form.evidenceGuidance, standardRef: form.standardRef || undefined, classLevel: form.classLevel || undefined };
                  if (edit === 'new') await call('/admin/units', { body: { ...body, tradeId: trade!.id, code: form.code } });
                  else if (edit) await call(`/admin/units/${edit.id}`, { method: 'PATCH', body: { ...body, standardRef: form.standardRef || null, classLevel: form.classLevel || null } });
                  toast('Saved', 'success');
                  setEdit(null);
                  void load();
                } catch (e) {
                  toast((e as Error).message, 'danger');
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {edit === 'new' ? <Field label="Code" htmlFor="u-code"><Input id="u-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field> : null}
          <Field label="Title (English)" htmlFor="u-t"><Input id="u-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Title (chiShona)" htmlFor="u-sn" optional="needs review"><Input id="u-sn" value={form.titleSn} onChange={(e) => setForm({ ...form, titleSn: e.target.value })} /></Field>
          <Field label="Title (isiNdebele)" htmlFor="u-nd" optional="needs review"><Input id="u-nd" value={form.titleNd} onChange={(e) => setForm({ ...form, titleNd: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="What a competent artisan can do" htmlFor="u-d"><Textarea id="u-d" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Evidence guidance" htmlFor="u-e" hint="Shown to artisans and used for suggestions."><Textarea id="u-e" value={form.evidenceGuidance} onChange={(e) => setForm({ ...form, evidenceGuidance: e.target.value })} /></Field></div>
          <Field label="Official unit standard" htmlFor="u-s" optional="when confirmed"><Input id="u-s" value={form.standardRef} onChange={(e) => setForm({ ...form, standardRef: e.target.value })} /></Field>
          <Field label="Trade-test class" htmlFor="u-c" optional="when confirmed"><Input id="u-c" value={form.classLevel} onChange={(e) => setForm({ ...form, classLevel: e.target.value })} /></Field>
        </div>
      </Dialog>
    </div>
  );
}
