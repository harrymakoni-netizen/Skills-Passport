'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Skeleton, Textarea } from '@sp/ui';
import { Dialog, Tabs, useToast } from '@sp/ui/client';
import { call } from '@/lib/client';
import { fmtDateTime } from '@/lib/format';

type Flag = {
  id: string; entity: string; entityId: string; rule: string; severity: 'soft' | 'standard' | 'high'; reason: string; status: string; createdAt: string; resolutionNote: string | null;
  job: { id: string; ref: string; status: string; jobType: string; thumbs: string[] } | null;
  artisan: { id: string; displayName: string; passportCode: string; levelFrozen: boolean } | null;
  verifier: { id: string; name: string } | null;
};

const SEV = { high: 'danger', standard: 'warning', soft: 'neutral' } as const;
const RULE_NAME: Record<string, string> = {
  FR01_client_is_registered_phone: 'Client is a registered user',
  FR02_same_client_repeat: 'Same client, repeated jobs',
  FR03_confirmation_ring: 'Possible confirmation ring',
  FR04_duplicate_image: 'Duplicate photo',
  FR05_old_capture_date: 'Old photo',
  FR06_suspect_image: 'Screenshot or downloaded image',
  FR07_location_mismatch: 'Location far from stated area',
  FR08_recently_registered_client: 'Recently registered client',
  FR09_repeated_incidents: 'Repeated disputes or rejections',
  FR10_verifier_conflict: 'Verifier conflict of interest',
  FR11_verifier_approval_rate: 'Unusually high approval rate',
  AGENT_JOB_DENIED: 'Artisan denied an agent-logged job',
};

/** Fraud review queue (PROMPTS M7): by severity, with evidence; uphold or clear; everything audited. */
export function Flags() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [active, setActive] = useState<{ flag: Flag; decision: 'uphold' | 'clear' } | null>(null);
  const [note, setNote] = useState('');
  const [reject, setReject] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setFlags(null);
    call<Flag[]>(`/admin/flags?status=${status}`).then(setFlags).catch((e) => toast((e as Error).message, 'danger'));
  }, [status, toast]);
  useEffect(() => load(), [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administrator" title="Fraud review" description="Flags send jobs to review and never reject anything on their own. Upholding a flag can reject the job or freeze the artisan’s level." />
      <Tabs label="Status" value={status} onChange={setStatus} tabs={[{ id: 'open', label: 'Open' }, { id: 'upheld', label: 'Upheld' }, { id: 'cleared', label: 'Cleared' }]} />
      {flags === null ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : flags.length === 0 ? (
        <EmptyState title={status === 'open' ? 'No open flags' : 'Nothing here yet'} body="Flags appear when a fraud rule matches a job, client, artisan or verifier." />
      ) : (
        <ul className="flex flex-col gap-3">
          {flags.map((f) => (
            <li key={f.id} className="flex flex-col gap-4 rounded-lg border border-rule bg-raised p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                {f.job?.thumbs.length ? (
                  <div className="flex shrink-0 gap-1">
                    {f.job.thumbs.slice(0, 2).map((t) => <img key={t} src={t} alt="" className="size-16 rounded-sm object-cover" />)}
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEV[f.severity]}>{f.severity}</Badge>
                    <span className="font-semibold">{RULE_NAME[f.rule] ?? f.rule}</span>
                    <span className="text-xs text-muted">{fmtDateTime(f.createdAt)}</span>
                  </div>
                  <p className="text-sm">{f.reason}</p>
                  <p className="text-sm text-muted">
                    {f.job ? <><span className="font-mono text-xs">{f.job.ref}</span> · {f.job.jobType} · status {f.job.status.replace(/_/g, ' ')} · </> : null}
                    {f.artisan ? <a className="text-ink-900 underline-offset-4 hover:underline" href={`/p/${f.artisan.passportCode}`} target="_blank" rel="noreferrer">{f.artisan.displayName}</a> : null}
                    {f.verifier ? <>Verifier {f.verifier.name}</> : null}
                    {f.entity === 'client' ? <>Client record</> : null}
                  </p>
                  {f.resolutionNote ? <p className="text-sm text-muted">Note: {f.resolutionNote}</p> : null}
                </div>
              </div>
              {f.status === 'open' ? (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setActive({ flag: f, decision: 'clear' }); setNote(''); }}>Clear</Button>
                  <Button size="sm" variant="danger" onClick={() => { setActive({ flag: f, decision: 'uphold' }); setNote(''); setReject(f.entity === 'job'); setFreeze(false); }}>Uphold</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.decision === 'uphold' ? 'Uphold this flag' : 'Clear this flag'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
            <Button
              variant={active?.decision === 'uphold' ? 'danger' : 'primary'}
              loading={busy}
              disabled={note.trim().length < 3}
              onClick={async () => {
                if (!active) return;
                setBusy(true);
                try {
                  await call(`/admin/flags/${active.flag.id}/resolve`, { body: { decision: active.decision, note, rejectJob: active.decision === 'uphold' && reject, freezeArtisan: active.decision === 'uphold' && freeze } });
                  toast('Decision recorded in the audit log', 'success');
                  setActive(null);
                  load();
                } catch (e) {
                  toast((e as Error).message, 'danger');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {active?.decision === 'uphold' ? 'Uphold' : 'Clear flag'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Reason" htmlFor="flag-note" hint="Recorded in the audit log.">
            <Textarea id="flag-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          {active?.decision === 'uphold' ? (
            <>
              {active.flag.entity === 'job' ? <Checkbox checked={reject} onChange={(e) => setReject(e.target.checked)} label="Reject the job" description="It stops counting toward the passport. The artisan is told." /> : null}
              {active.flag.artisan ? <Checkbox checked={freeze} onChange={(e) => setFreeze(e.target.checked)} label="Freeze the artisan’s level" description="Level changes stop until you unfreeze." /> : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
