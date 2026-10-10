import { templateSubmissions } from '@sp/core';
import { audit } from './admin';
import type { ServiceContext } from './context';

export interface WhatsAppTemplateRow {
  name: string;
  key: string;
  lang: string;
  /** Meta's review status, or `NOT_SUBMITTED`. */
  status: string;
  rejectedReason: string | null;
  body: string;
}

/**
 * WhatsApp setup for the admin console: which channel is live, the webhook address to register with Meta, and the
 * review status of every template in the registry (business-initiated messages fail until Meta approves them).
 */
export async function whatsappStatus(ctx: ServiceContext, cfg: { driver: string; verifyTokenSet: boolean; businessAccountSet: boolean }) {
  const wa = ctx.adapters.whatsapp;
  const base = {
    driver: cfg.driver,
    webhookUrl: `${ctx.publicBaseUrl}/api/webhooks/whatsapp`,
    verifyTokenSet: cfg.verifyTokenSet,
    businessAccountSet: cfg.businessAccountSet,
  };
  const subs = templateSubmissions();
  const rows = (registered: Map<string, { status: string; rejected_reason?: string }>): WhatsAppTemplateRow[] =>
    subs.map((s) => {
      const r = registered.get(`${s.name}|${s.language}`);
      const body = s.components.find((c) => c.type === 'BODY');
      return { name: s.name, key: s.key, lang: s.lang, status: r?.status ?? 'NOT_SUBMITTED', rejectedReason: r?.rejected_reason && r.rejected_reason !== 'NONE' ? r.rejected_reason : null, body: body?.type === 'BODY' ? body.text : '' };
    });
  if (!wa || !cfg.businessAccountSet) return { ...base, templatesError: wa ? 'Set WHATSAPP_BUSINESS_ACCOUNT_ID to see template status.' : null, templates: rows(new Map()) };
  try {
    const list = await wa.listTemplates();
    return { ...base, templatesError: null, templates: rows(new Map(list.map((t) => [`${t.name}|${t.language}`, t]))) };
  } catch (err) {
    return { ...base, templatesError: err instanceof Error ? err.message : String(err), templates: rows(new Map()) };
  }
}

/** Submits every registry template Meta does not have yet. Audited. */
export async function submitMissingTemplates(ctx: ServiceContext, actorId: string) {
  const wa = ctx.adapters.whatsapp;
  if (!wa) throw new Error('WhatsApp is not enabled (MESSAGING_DRIVER is mock)');
  const existing = new Set((await wa.listTemplates()).map((t) => `${t.name}|${t.language}`));
  const results: { name: string; ok: boolean; status?: string; error?: string }[] = [];
  for (const s of templateSubmissions()) {
    if (existing.has(`${s.name}|${s.language}`)) continue;
    try {
      const r = await wa.createTemplate(s);
      results.push({ name: s.name, ok: true, status: r.status });
    } catch (err) {
      results.push({ name: s.name, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  await audit(ctx, actorId, 'whatsapp.templates.submit', 'whatsapp_template', null, { submitted: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => r.name) });
  return results;
}
