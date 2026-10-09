'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@sp/ui';
import { useToast } from '@sp/ui/client';
import { call } from '@/lib/client';
import { age } from '@/lib/format';

type Task = {
  id: string;
  kind: string;
  note: string | null;
  createdAt: string;
  artisan: { displayName: string; passportCode: string; phone: string | null } | null;
  job: { id: string; ref: string; status: string; jobType: string; clientName: string | null; clientPhone: string | null } | null;
};

const KIND: Record<string, string> = {
  client_followup: 'Call the client',
  area_not_listed: 'Add an area',
  artisan_help: 'Artisan asked for help',
  demonstration: 'Arrange a demonstration',
};

/** Phone follow-ups for unanswered or undeliverable confirmations (SPEC 4.3) and artisan help requests. */
export function Tasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => call<Task[]>('/agent/tasks').then(setTasks).catch((e) => setError((e as Error).message)), []);
  useEffect(() => void load(), [load]);

  async function outcome(t: Task, o: string) {
    try {
      await call('/agent/tasks/outcome', { body: { taskId: t.id, outcome: o } });
      toast(o === 'not_reached' ? 'Saved. Try again later.' : 'Outcome recorded', 'success');
      void load();
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Field agent" title="Follow-ups" description="Clients who did not answer, could not be reached on WhatsApp or stopped messages. Call them and record what they said. You cannot confirm a job yourself — only the client can." />
      {error ? <ErrorState title="Could not load follow-ups" body={error} /> : null}
      {tasks === null ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState title="Nothing to follow up" body="New tasks appear when a client doesn’t answer within 7 days, isn’t on WhatsApp, or an artisan asks for help." />
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-lg border border-rule bg-raised p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={t.kind === 'client_followup' ? 'warning' : 'ink'}>{KIND[t.kind] ?? t.kind}</Badge>
                  <span className="font-mono text-xs text-muted">{age(t.createdAt)} ago</span>
                  {t.job ? <span className="font-mono text-xs">{t.job.ref}</span> : null}
                </div>
                <p className="text-sm">
                  {t.job ? (
                    <>
                      <span className="font-semibold">{t.job.clientName ?? 'Client'}</span>{' '}
                      {t.job.clientPhone ? <a href={`tel:${t.job.clientPhone}`} className="font-mono text-ink-900 underline underline-offset-4">{t.job.clientPhone}</a> : null}
                      <span className="text-muted"> · {t.job.jobType} by {t.artisan?.displayName}</span>
                    </>
                  ) : t.artisan ? (
                    <>
                      <span className="font-semibold">{t.artisan.displayName}</span>{' '}
                      {t.artisan.phone ? <a href={`tel:${t.artisan.phone}`} className="font-mono text-ink-900 underline underline-offset-4">{t.artisan.phone}</a> : null}
                    </>
                  ) : null}
                </p>
                {t.note ? <p className="text-sm text-muted">{t.note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.kind === 'client_followup' ? (
                  <>
                    <Button size="sm" onClick={() => void outcome(t, 'confirmed')}>Client confirmed</Button>
                    <Button size="sm" variant="danger" onClick={() => void outcome(t, 'disputed')}>Client said no</Button>
                    <Button size="sm" variant="secondary" onClick={() => void outcome(t, 'not_reached')}>No answer</Button>
                    {t.job?.status === 'client_expired' ? <Button size="sm" variant="ghost" onClick={() => void outcome(t, 'closed')}>Close job</Button> : null}
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void outcome(t, 'done')}>Mark done</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
