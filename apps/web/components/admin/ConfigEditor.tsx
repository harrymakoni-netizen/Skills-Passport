'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, PageHeader, Panel, Skeleton } from '@sp/ui';
import { useToast } from '@sp/ui/client';
import { call } from '@/lib/client';
import { fmtDateTime } from '@/lib/format';

type Version = { version: number; params: Record<string, Record<string, unknown>>; activeFrom: string; note: string | null };

const SECTION: Record<string, string> = {
  levels: 'Passport levels',
  sampling: 'Review sampling',
  competency: 'Competency status',
  endorsement: 'Endorsements',
  fraud: 'Fraud thresholds',
  confirmation: 'Client confirmation',
  clients: 'Client safety',
  media: 'Media',
  trust: 'Trust score',
  workRequests: 'Work requests',
};
const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** Thresholds live in versioned config rows (CLAUDE.md). Saving never edits in place: it creates a new version. */
export function ConfigEditor() {
  const toast = useToast();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    call<Version[]>('/admin/config').then((v) => {
      setVersions(v);
      setDraft(structuredClone(v[0]?.params ?? {}));
    });
  useEffect(() => void load(), []);  

  if (!versions || !draft) return <Skeleton className="h-96" />;
  const setAt = (path: string[], value: unknown) => {
    const next = structuredClone(draft);
    let o = next as Record<string, unknown>;
    for (const p of path.slice(0, -1)) o = o[p] as Record<string, unknown>;
    o[path[path.length - 1]!] = value;
    setDraft(next);
  };
  const renderFields = (obj: Record<string, unknown>, path: string[]): React.ReactNode =>
    Object.entries(obj).map(([k, v]) => {
      const p = [...path, k];
      const id = p.join('.');
      if (v && typeof v === 'object' && !Array.isArray(v))
        return (
          <fieldset key={id} className="col-span-full grid gap-3 border-t border-rule pt-3 sm:grid-cols-3">
            <legend className="col-span-full pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label(k)}</legend>
            {renderFields(v as Record<string, unknown>, p)}
          </fieldset>
        );
      if (typeof v === 'boolean')
        return (
          <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={v} onChange={(e) => setAt(p, e.target.checked)} className="size-4 accent-ink-900" />
            {label(k)}
          </label>
        );
      if (Array.isArray(v))
        return (
          <Field key={id} label={label(k)} htmlFor={id} hint="Comma-separated">
            <Input id={id} value={v.join(', ')} onChange={(e) => setAt(p, e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)))} />
          </Field>
        );
      return (
        <Field key={id} label={label(k)} htmlFor={id}>
          <Input id={id} type="number" step="any" value={String(v)} onChange={(e) => setAt(p, Number(e.target.value))} className="font-mono tabular" />
        </Field>
      );
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administrator" title="Rules configuration" description={`Active: version ${versions[0]?.version}. Every save creates a new version; level history records which version applied.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          {Object.entries(draft).map(([section, v]) => (
            <Panel key={section} title={SECTION[section] ?? label(section)}>
              <div className="grid gap-4 p-4 sm:grid-cols-3">{renderFields(v as Record<string, unknown>, [section])}</div>
            </Panel>
          ))}
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Save as a new version">
            <div className="flex flex-col gap-3 p-4">
              <Field label="What changed and why" htmlFor="cfg-note">
                <Input id="cfg-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lower duplicate-photo threshold after pilot review" />
              </Field>
              <Button
                loading={busy}
                disabled={note.trim().length < 3}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await call<{ version: number }>('/admin/config', { method: 'PUT', body: { params: draft, note } });
                    toast(`Version ${r.version} is now active`, 'success');
                    setNote('');
                    void load();
                  } catch (e) {
                    toast((e as Error).message, 'danger');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save version
              </Button>
            </div>
          </Panel>
          <Panel title="History">
            <ol className="divide-y divide-rule">
              {versions.map((v) => (
                <li key={v.version} className="flex flex-col px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs">v{v.version} · {fmtDateTime(v.activeFrom)}</span>
                  <span className="text-muted">{v.note}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
