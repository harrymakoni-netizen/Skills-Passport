'use client';
import { useState } from 'react';
import { Badge, Button, EmptyState, PageHeader, Panel, Table, TD, TH } from '@sp/ui';
import { useToast } from '@sp/ui/client';
import { call } from '@/lib/client';

export type WhatsAppStatus = {
  driver: 'mock' | 'whatsapp' | 'hybrid';
  webhookUrl: string;
  verifyTokenSet: boolean;
  businessAccountSet: boolean;
  templatesError: string | null;
  templates: {
    name: string;
    key: string;
    lang: string;
    status: string;
    rejectedReason: string | null;
    body: string;
  }[];
};

const MODE = {
  mock: {
    label: 'Simulator only',
    tone: 'neutral',
    note: 'No real WhatsApp messages are sent. Every phone is simulated at /dev/chat.',
  },
  whatsapp: {
    label: 'WhatsApp Cloud API',
    tone: 'success',
    note: 'Every message goes through the WhatsApp Business number.',
  },
  hybrid: {
    label: 'WhatsApp + simulator',
    tone: 'success',
    note: 'Real numbers use WhatsApp. Demo numbers (+26377000xxxx) stay in the simulator.',
  },
} as const;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  IN_APPEAL: 'warning',
  REJECTED: 'danger',
  PAUSED: 'danger',
  DISABLED: 'danger',
};
const LANG = { en: 'English', sn: 'chiShona', nd: 'isiNdebele' } as Record<string, string>;

/** Admin: WhatsApp connection checklist and template approval status, with one-click submission to Meta. */
export function WhatsAppSetup({ initial }: { initial: WhatsAppStatus }) {
  const toast = useToast();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const mode = MODE[status.driver];
  const missing = status.templates.filter((t) => t.status === 'NOT_SUBMITTED').length;
  const approved = status.templates.filter((t) => t.status === 'APPROVED').length;
  const canSubmit =
    status.driver !== 'mock' && status.businessAccountSet && !status.templatesError && missing > 0;

  async function refresh() {
    setStatus(await call<WhatsAppStatus>('/admin/whatsapp'));
  }

  async function submit() {
    setBusy(true);
    try {
      const results = await call<{ name: string; ok: boolean; error?: string }[]>(
        '/admin/whatsapp/templates/submit',
        { method: 'POST', body: {} },
      );
      const failed = results.filter((r) => !r.ok);
      toast(
        failed.length
          ? `${results.length - failed.length} submitted. ${failed.length} failed: ${failed[0]!.error}`
          : `${results.length} templates sent to Meta for review.`,
        failed.length ? 'danger' : 'success',
      );
      await refresh();
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administrator"
        title="WhatsApp"
        description="The connection to the WhatsApp Business number, and the message templates Meta must approve before clients and artisans can be messaged first."
      />
      <Panel title="Connection">
        <dl className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-4">
          <dt className="text-sm text-muted">Mode</dt>
          <dd className="mb-3 sm:mb-0 flex flex-col gap-1">
            <span>
              <Badge tone={mode.tone} dot>
                {mode.label}
              </Badge>
            </span>
            <span className="text-sm text-muted">{mode.note}</span>
          </dd>
          <dt className="text-sm text-muted">Webhook URL</dt>
          <dd className="mb-3 sm:mb-0 break-all font-mono text-sm">{status.webhookUrl}</dd>
          <dt className="text-sm text-muted">Verify token</dt>
          <dd className="mb-3 text-sm sm:mb-0">
            {status.verifyTokenSet ? (
              'Set'
            ) : (
              <span className="text-danger">Not set (WHATSAPP_VERIFY_TOKEN)</span>
            )}
          </dd>
          <dt className="text-sm text-muted">Business account</dt>
          <dd className="text-sm">
            {status.businessAccountSet ? (
              'Set'
            ) : (
              <span className="text-danger">Not set (WHATSAPP_BUSINESS_ACCOUNT_ID)</span>
            )}
          </dd>
        </dl>
      </Panel>
      <Panel
        title="Message templates"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            {canSubmit ? (
              <Button size="sm" loading={busy} onClick={() => void submit()}>
                Submit {missing} to Meta
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted">
            <span className="tabular">{approved}</span> of{' '}
            <span className="tabular">{status.templates.length}</span> approved. Meta usually reviews utility
            templates within minutes, sometimes up to a day. chiShona and isiNdebele wording is a draft for
            native-speaker review.
          </p>
          {status.templatesError ? <p className="text-sm text-danger">{status.templatesError}</p> : null}
          {status.templates.length ? (
            <Table>
              <thead>
                <tr>
                  <TH>Template</TH>
                  <TH>Language</TH>
                  <TH>Status</TH>
                  <TH>Body</TH>
                </tr>
              </thead>
              <tbody>
                {status.templates.map((t) => (
                  <tr key={t.name}>
                    <TD className="font-mono text-xs">{t.name}</TD>
                    <TD className="whitespace-nowrap">{LANG[t.lang] ?? t.lang}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>
                        {t.status === 'NOT_SUBMITTED'
                          ? 'Not submitted'
                          : t.status.charAt(0) + t.status.slice(1).toLowerCase().replace('_', ' ')}
                      </Badge>
                      {t.rejectedReason ? (
                        <span className="mt-1 block text-xs text-danger">{t.rejectedReason}</span>
                      ) : null}
                    </TD>
                    <TD className="max-w-md whitespace-pre-line text-xs text-muted">{t.body}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No templates in the registry" />
          )}
        </div>
      </Panel>
    </div>
  );
}
