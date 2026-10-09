'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, Checkbox, Field, Input, PageHeader, Select, Textarea, buttonClass } from '@sp/ui';
import { call } from '@/lib/client';

type Artisan = { id: string; passportCode: string; displayName: string; level: string; area: { id: string; name: string }; trades: { id: string; name: string; jobTypes: { id: string; name: string; needsBeforePhoto: boolean }[] }[] };
type Upload = { key: string; kind: 'photo_before' | 'photo_after' | 'voice' | 'video'; name: string; preview?: string };

/** SPEC 4.5: an agent logs a job on their phone with the artisan present; uploads go straight to storage via signed URLs. */
export function LogJob({ areas }: { areas: { id: string; name: string; city: string }[] }) {
  const [q, setQ] = useState('');
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [jobTypeId, setJobTypeId] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', jobDate: new Date().toISOString().slice(0, 10), areaId: '', amount: '', notes: '', present: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setQ(code);
      void find(code);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  async function find(term = q) {
    setLookupError(null);
    try {
      const a = await call<Artisan>(`/agent/artisans?q=${encodeURIComponent(term)}`);
      setArtisan(a);
      setForm((f) => ({ ...f, areaId: a.area.id }));
    } catch (e) {
      setArtisan(null);
      setLookupError((e as Error).message);
    }
  }

  async function upload(files: FileList | null, kind: Upload['kind']) {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { key, url } = await call<{ key: string; url: string }>('/media/upload-url', { body: { kind, mimeType: file.type || 'application/octet-stream' } });
        const target = url.startsWith('http') ? new URL(url) : null;
        const sameOriginUrl = target && target.pathname.startsWith('/media/') ? `${target.pathname}${target.search}` : url;
        const r = await fetch(sameOriginUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
        if (!r.ok) throw new Error('Upload failed');
        setUploads((u) => [...u, { key, kind, name: file.name, ...(file.type.startsWith('image') ? { preview: URL.createObjectURL(file) } : {}) }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const types = artisan?.trades.flatMap((t) => t.jobTypes.map((j) => ({ ...j, trade: t.name }))) ?? [];

  if (done)
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <PageHeader eyebrow="Field agent" title={`Job ${done} logged`} />
        <p>{artisan?.displayName} will get a WhatsApp message asking them to confirm the job is theirs. Then the client is asked to confirm it.</p>
        <a href="/agent/log" className={buttonClass('secondary', 'md', 'self-start')}>Log another job</a>
      </div>
    );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Field agent" title="Log a job" description="With the artisan present. Use your phone’s camera for photos; the artisan can record the voice note on your phone." />
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <Field label="Passport number or the artisan’s phone" htmlFor="q" error={lookupError}>
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SP-HRE-00001" />
        </Field>
        <Button type="submit" variant="secondary">Find</Button>
      </form>

      {artisan ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await call<{ ref: string }>('/agent/jobs', {
                body: {
                  passportCode: artisan.passportCode,
                  jobTypeId,
                  clientName: form.clientName,
                  clientPhone: form.clientPhone,
                  jobDate: form.jobDate,
                  areaId: form.areaId,
                  amountCents: form.amount ? Math.round(Number(form.amount) * 100) : null,
                  notes: form.notes || undefined,
                  uploads: uploads.map((u) => ({ key: u.key, kind: u.kind })),
                  artisanPresent: form.present,
                },
              });
              setDone(r.ref);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex items-center gap-3 rounded-md border border-rule bg-raised px-4 py-3">
            <span className="font-semibold">{artisan.displayName}</span>
            <span className="serial text-xs text-muted">{artisan.passportCode}</span>
            <Badge tone="ink">{artisan.level}</Badge>
          </div>
          <Field label="Job type" htmlFor="jt">
            <Select id="jt" required value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value)}>
              <option value="">Choose…</option>
              {types.map((j) => <option key={j.id} value={j.id}>{j.trade}: {j.name}</option>)}
            </Select>
          </Field>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            {(['photo_before', 'photo_after', 'voice'] as const).map((kind) => (
              <label key={kind} className="flex min-h-24 cursor-pointer flex-col items-start justify-between gap-2 rounded-md border border-dashed border-rule-strong bg-raised p-3 text-sm hover:border-ink-700">
                <span className="font-semibold">{kind === 'photo_before' ? 'Before photos' : kind === 'photo_after' ? 'After photos' : 'Voice note'}</span>
                <span className="text-muted">{uploads.filter((u) => u.kind === kind).length} added</span>
                <input type="file" className="sr-only" multiple={kind !== 'voice'} accept={kind === 'voice' ? 'audio/*' : 'image/*'} capture={kind === 'voice' ? undefined : 'environment'} onChange={(e) => void upload(e.target.files, kind)} />
              </label>
            ))}
          </fieldset>
          {uploads.some((u) => u.preview) ? (
            <div className="flex gap-2 overflow-x-auto">{uploads.filter((u) => u.preview).map((u) => <img key={u.key} src={u.preview} alt={u.name} className="size-20 shrink-0 rounded-md object-cover" />)}</div>
          ) : null}
          {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor="cn"><Input id="cn" required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></Field>
            <Field label="Client phone" htmlFor="cp" hint="Not the artisan’s or your own number."><Input id="cp" inputMode="tel" required value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} /></Field>
            <Field label="Date of the job" htmlFor="jd"><Input id="jd" type="date" required value={form.jobDate} onChange={(e) => setForm({ ...form, jobDate: e.target.value })} /></Field>
            <Field label="Area" htmlFor="ar"><Select id="ar" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.city}</option>)}</Select></Field>
            <Field label="Amount charged (US$)" htmlFor="am" optional="private, optional"><Input id="am" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          </div>
          <Field label="What was done" htmlFor="nt" optional="if there is no voice note"><Textarea id="nt" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Checkbox checked={form.present} onChange={(e) => setForm({ ...form, present: e.target.checked })} label="The artisan is with me and agrees to log this job" />
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" loading={busy} disabled={!form.present || !jobTypeId || !uploads.some((u) => u.kind === 'photo_after')} className="self-start">Log job</Button>
        </form>
      ) : null}
    </div>
  );
}
