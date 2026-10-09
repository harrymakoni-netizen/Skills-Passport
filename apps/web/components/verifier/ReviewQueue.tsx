'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, Field, Skeleton, Textarea, cx } from '@sp/ui';
import { Dialog, useToast } from '@sp/ui/client';
import { call } from '@/lib/client';
import { age, fmtDate } from '@/lib/format';
import { REASON, type Detail, type QueueItem } from './types';
import { Viewer } from './Viewer';

type Quality = 'meets' | 'needs_improvement' | 'reject';
const QUALITIES: { id: Quality; key: string; label: string; tone: string }[] = [
  { id: 'meets', key: '1', label: 'Meets the standard', tone: 'border-success text-success bg-success-50' },
  { id: 'needs_improvement', key: '2', label: 'Needs improvement', tone: 'border-warning text-warning bg-warning-50' },
  { id: 'reject', key: '3', label: 'Not accepted', tone: 'border-danger text-danger bg-danger-50' },
];

/**
 * SPEC 4.4 verifier queue. Keyboard: J/K move, 1/2/3 rate, Ctrl+Enter submit, E endorse, ? shortcuts.
 * Flagged and disputed jobs first, then oldest.
 */
export function ReviewQueue() {
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [units, setUnits] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [help, setHelp] = useState(false);
  const [demo, setDemo] = useState(false);
  const [endorse, setEndorse] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const q = await call<QueueItem[]>(`/reviews/queue${filter === 'flagged' ? '?flagged=1' : ''}`);
      setQueue(q);
      setSelected((s) => (s && q.some((x) => x.id === s) ? s : (q[0]?.id ?? null)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let live = true;
    setLoadingDetail(true);
    call<Detail>(`/reviews/jobs/${selected}`)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setQuality(null);
        setNote('');
        setUnits(new Set(d.units.filter((u) => (u.aiConfidence ?? 0) >= 0.8).map((u) => u.id)));
      })
      .catch((e) => toast((e as Error).message, 'danger'))
      .finally(() => live && setLoadingDetail(false));
    return () => {
      live = false;
    };
  }, [selected, toast]);

  const index = useMemo(() => queue?.findIndex((q) => q.id === selected) ?? -1, [queue, selected]);

  const submit = useCallback(async () => {
    if (!detail || !quality) return;
    setSubmitting(true);
    try {
      await call(`/jobs/${detail.id}/review`, {
        body: { quality, confirmedUnitIds: [...units], removedUnitIds: detail.units.filter((u) => u.aiConfidence !== null && !units.has(u.id)).map((u) => u.id), note: note.trim() || null },
      });
      toast(`${detail.ref} reviewed — the artisan has been told`, 'success');
      const next = queue?.[index + 1]?.id ?? queue?.[index - 1]?.id ?? null;
      setQueue((q) => q?.filter((x) => x.id !== detail.id) ?? null);
      setSelected(next);
      setMobileDetail(Boolean(next) && mobileDetail);
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setSubmitting(false);
    }
  }, [detail, quality, units, note, queue, index, toast, mobileDetail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
        return;
      }
      if (!queue?.length) return;
      if (e.key === 'j' || e.key === 'ArrowDown') setSelected(queue[Math.min(queue.length - 1, index + 1)]!.id);
      else if (e.key === 'k' || e.key === 'ArrowUp') setSelected(queue[Math.max(0, index - 1)]!.id);
      else if (e.key === '1' || e.key === '2' || e.key === '3') setQuality(QUALITIES[Number(e.key) - 1]!.id);
      else if (e.key === 'e' && detail?.endorsement.eligible) setEndorse(true);
      else if (e.key === '?') setHelp(true);
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, index, detail, submit]);

  if (error) return <ErrorState title="The queue could not load" body={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
        <div className="flex flex-col gap-1">
          <p className="smallcaps text-muted">Verifier</p>
          <h1 className="font-display text-xl font-semibold">Review queue</h1>
          <p className="text-sm text-muted">Flagged and disputed jobs first, then the oldest. Target turnaround: 72 hours.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Filter" className="flex rounded-md border border-rule-strong bg-raised p-0.5 text-sm">
            {(['all', 'flagged'] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} type="button" onClick={() => setFilter(f)} className={cx('min-h-9 rounded-sm px-3', filter === f ? 'bg-ink-900 font-semibold text-paper' : 'text-muted hover:text-text')}>
                {f === 'all' ? 'All' : 'Flagged only'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setHelp(true)} aria-keyshortcuts="?">
            Shortcuts <kbd className="ml-1 rounded-sm border border-rule-strong px-1 font-mono text-xs">?</kbd>
          </Button>
        </div>
      </div>

      {queue === null ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
          <Skeleton className="h-[60vh]" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState title={filter === 'flagged' ? 'No flagged jobs' : 'The queue is clear'} body="New jobs appear here when clients confirm them and they are selected for review. You will also see disputed and flagged jobs straight away." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ol className={cx('flex flex-col gap-1 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto lg:pr-1', mobileDetail && 'hidden lg:flex')} aria-label="Jobs waiting for review">
            {queue.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(q.id);
                    setMobileDetail(true);
                  }}
                  aria-current={q.id === selected ? 'true' : undefined}
                  className={cx('flex w-full gap-3 rounded-md border p-2 text-left transition-colors duration-150', q.id === selected ? 'border-ink-900 bg-raised' : 'border-transparent hover:border-rule hover:bg-raised')}
                >
                  {q.thumb ? <img src={q.thumb} alt="" className="size-12 shrink-0 rounded-sm object-cover" /> : <span className="size-12 shrink-0 rounded-sm bg-sunk" />}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium">{q.ref}</span>
                      <span className="font-mono text-xs text-muted tabular">{age(q.queuedAt)}</span>
                    </span>
                    <span className="truncate text-sm font-semibold">{q.jobType.en}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                      {q.artisan.displayName}
                      {q.flags.length || q.disputed ? (
                        <Badge tone="danger" className="!py-0">{q.disputed ? 'Disputed' : 'Flagged'}</Badge>
                      ) : (
                        <span>· {REASON[q.reason ?? ''] ?? 'Sample'}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className={cx('min-w-0', !mobileDetail && 'hidden lg:block')}>
            <button type="button" onClick={() => setMobileDetail(false)} className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-ink-900 lg:hidden">
              ← All jobs
            </button>
            {!detail || loadingDetail ? (
              <Skeleton className="h-[60vh]" />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="flex min-w-0 flex-col gap-5">
                  <header className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{detail.ref}</span>
                      <Badge tone={detail.flags.some((f) => f.status === 'open') || detail.disputed ? 'danger' : 'ink'}>{REASON[detail.reviewReason ?? ''] ?? 'Review'}</Badge>
                      {detail.agentAssisted ? <Badge>Logged by a field agent</Badge> : null}
                    </div>
                    <h2 className="font-display text-lg font-semibold">{detail.jobType.en}</h2>
                    <p className="text-sm text-muted">
                      <a className="font-semibold text-ink-900 hover:underline" href={`/p/${detail.artisan.passportCode}`} target="_blank" rel="noreferrer">
                        {detail.artisan.displayName}
                      </a>{' '}
                      · {detail.trade.en} · {detail.area ?? '—'} · {detail.jobDate ? fmtDate(detail.jobDate) : '—'}
                    </p>
                  </header>

                  {detail.flags.length ? (
                    <ul className="flex flex-col gap-1.5 rounded-md border border-danger/25 bg-danger-50 p-3 text-sm">
                      {detail.flags.map((f) => (
                        <li key={f.rule} className="flex gap-2">
                          <span className="font-semibold text-danger">{f.severity === 'soft' ? 'Note' : 'Flag'}</span>
                          <span>{f.reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <Viewer media={detail.media} />

                  {detail.media.filter((m) => m.kind === 'voice').map((m) => (
                    <div key={m.id} className="flex flex-col gap-2 rounded-lg border border-rule bg-raised p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Voice note</h3>
                        {m.transcript ? <span className="text-xs text-muted">Transcript · {Math.round(m.transcript.confidence * 100)}% confidence</span> : null}
                      </div>
                      {m.url ? <audio src={m.url} controls preload="none" className="w-full" /> : null}
                      {m.transcript ? <p className="text-sm leading-6">{m.transcript.text}</p> : <p className="text-sm text-muted">Transcript not ready yet.</p>}
                    </div>
                  ))}

                  {detail.notes.length ? (
                    <div className="flex flex-col gap-1 rounded-lg border border-rule bg-raised p-4 text-sm">
                      <h3 className="font-semibold">Written answers</h3>
                      {detail.notes.map((n, i) => (
                        <p key={i}>{n}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-4 2xl:grid-cols-2">
                    <div className="flex flex-col gap-2 rounded-lg border border-rule bg-raised p-4 text-sm">
                      <h3 className="font-semibold">Draft summary</h3>
                      {detail.artisanSummary ? (
                        <>
                          <p className="leading-6">{detail.artisanSummary.summary}</p>
                          <p className="text-xs text-muted">Corrected by the artisan</p>
                        </>
                      ) : detail.aiSummary ? (
                        <>
                          <p className="leading-6">{detail.aiSummary.summary}</p>
                          {detail.aiSummary.materials.length ? <p className="text-muted">Materials: {detail.aiSummary.materials.join(', ')}</p> : null}
                          {detail.aiSummary.safety_measures.length ? <p className="text-muted">Safety: {detail.aiSummary.safety_measures.join(', ')}</p> : null}
                          <p className="text-xs text-faint">Generated from the voice note and photos · {detail.aiSummary.prompt_version}</p>
                        </>
                      ) : (
                        <p className="text-muted">Summary not ready yet.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-rule bg-raised p-4 text-sm">
                      <h3 className="font-semibold">Client</h3>
                      {detail.confirmation?.response === 'confirmed' ? (
                        <p>
                          Confirmed{detail.confirmation.channel === 'agent' ? ' by phone with a field agent' : ' on WhatsApp'}
                          {detail.confirmation.rating ? <span className="font-mono"> · {detail.confirmation.rating}/5</span> : null}
                        </p>
                      ) : detail.confirmation?.response === 'disputed' ? (
                        <p className="text-danger">Said the work was not done</p>
                      ) : (
                        <p className="text-muted">No answer yet</p>
                      )}
                      {detail.confirmation?.comment ? <blockquote className="border-l-2 border-rule-strong pl-3 text-muted">“{detail.confirmation.comment}”</blockquote> : null}
                    </div>
                  </div>
                </section>

                <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-semibold">Quality</legend>
                    {QUALITIES.map((q) => (
                      <button key={q.id} type="button" aria-pressed={quality === q.id} onClick={() => setQuality(q.id)} className={cx('flex min-h-11 items-center justify-between rounded-md border px-3 text-left text-sm font-semibold transition-colors duration-150', quality === q.id ? q.tone : 'border-rule-strong bg-raised text-text hover:border-ink-700')}>
                        {q.label}
                        <kbd className="rounded-sm border border-current/30 px-1.5 font-mono text-xs opacity-70">{q.key}</kbd>
                      </button>
                    ))}
                  </fieldset>

                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-sm font-semibold">Skills shown in this job</legend>
                    <p className="mb-1 text-xs text-muted">Suggested units are ticked. Untick any the evidence does not show; tick any that are missing.</p>
                    <ul className="flex max-h-80 flex-col overflow-y-auto rounded-md border border-rule bg-raised">
                      {detail.units.map((u) => (
                        <li key={u.id} className="border-b border-rule last:border-0">
                          <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-ink-50" title={u.evidenceGuidance}>
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 accent-ink-900"
                              checked={units.has(u.id)}
                              onChange={(e) => {
                                const next = new Set(units);
                                if (e.target.checked) next.add(u.id);
                                else next.delete(u.id);
                                setUnits(next);
                              }}
                            />
                            <span className="flex flex-1 flex-col">
                              <span>
                                <span className="font-mono text-xs text-muted">{u.code}</span> {u.title.en}
                              </span>
                              {u.aiConfidence !== null ? <span className="text-xs text-muted">Suggested · {Math.round(u.aiConfidence * 100)}%</span> : null}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>

                  <Field label="Note to the artisan" htmlFor="note" optional="optional">
                    <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Specific and kind. It is sent on WhatsApp." />
                  </Field>

                  <div className="flex flex-col gap-2">
                    <Button onClick={() => void submit()} disabled={!quality} loading={submitting} aria-keyshortcuts="Control+Enter">
                      Submit review
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDemo(true)}>
                        Request demonstration
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEndorse(true)} disabled={!detail.endorsement.eligible} title={detail.endorsement.eligible ? 'E' : undefined}>
                        Endorse
                      </Button>
                    </div>
                    {!detail.endorsement.eligible && detail.endorsement.reason === 'not_enough_reviews' ? (
                      <p className="text-xs text-muted">
                        Endorsing needs {detail.endorsement.needed} of this artisan’s jobs reviewed by you as meeting the standard ({detail.endorsement.meetsByMe} so far).
                      </p>
                    ) : null}
                    {!detail.endorsement.eligible && detail.endorsement.reason === 'already_endorsed' ? <p className="text-xs text-muted">You have already endorsed this artisan for this trade.</p> : null}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
          {[
            ['J / ↓', 'Next job'],
            ['K / ↑', 'Previous job'],
            ['1 · 2 · 3', 'Meets · Needs improvement · Not accepted'],
            ['Ctrl + Enter', 'Submit review'],
            ['E', 'Endorse (when eligible)'],
            ['Click photo', 'Zoom in at that point'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-xs">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
      {detail ? <DemoDialog open={demo} onClose={() => setDemo(false)} jobId={detail.id} /> : null}
      {detail ? <EndorseDialog open={endorse} onClose={() => setEndorse(false)} detail={detail} onDone={() => setDetail({ ...detail, endorsement: { eligible: false, reason: 'already_endorsed', meetsByMe: 0, needed: 0 } })} /> : null}
    </div>
  );
}

function DemoDialog({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId: string }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a practical demonstration"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call(`/jobs/${jobId}/demonstration`, { body: { note } });
                toast('Request sent. A field agent will arrange it.', 'success');
                onClose();
              } catch (e) {
                toast((e as Error).message, 'danger');
              } finally {
                setBusy(false);
              }
            }}
          >
            Send request
          </Button>
        </>
      }
    >
      <Field label="What should the artisan show?" htmlFor="demo-note" optional="optional">
        <Textarea id="demo-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
      </Field>
    </Dialog>
  );
}

function EndorseDialog({ open, onClose, detail, onDone }: { open: boolean; onClose: () => void; detail: Detail; onDone: () => void }) {
  const toast = useToast();
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Endorse ${detail.artisan.displayName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={statement.trim().length < 20}
            onClick={async () => {
              setBusy(true);
              try {
                await call(`/artisans/${detail.artisan.id}/endorse`, { body: { jobId: detail.id, statement } });
                toast('Endorsement added to the passport', 'success');
                onDone();
                onClose();
              } catch (e) {
                toast((e as Error).message, 'danger');
              } finally {
                setBusy(false);
              }
            }}
          >
            Endorse
          </Button>
        </>
      }
    >
      <Field label="Your endorsement" htmlFor="statement" hint="Shown on the public passport with your name. Say what you saw, in one or two sentences.">
        <Textarea id="statement" value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={400} placeholder="I reviewed three of their installations. The wiring is neat, correctly protected and safe." />
      </Field>
    </Dialog>
  );
}
