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
  const phone = wa ? await wa.phoneNumberInfo().catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) })) : null;
  const subs = templateSubmissions();
  const rows = (registered: Map<string, { status: string; rejected_reason?: string }>): WhatsAppTemplateRow[] =>
    subs.map((s) => {
      const r = registered.get(`${s.name}|${s.language}`);
      const body = s.components.find((c) => c.type === 'BODY');
      return { name: s.name, key: s.key, lang: s.lang, status: r?.status ?? 'NOT_SUBMITTED', rejectedReason: r?.rejected_reason && r.rejected_reason !== 'NONE' ? r.rejected_reason : null, body: body?.type === 'BODY' ? body.text : '' };
    });
  if (!wa || !cfg.businessAccountSet) return { ...base, phone, templatesError: wa ? 'Set WHATSAPP_BUSINESS_ACCOUNT_ID to see template status.' : null, templates: rows(new Map()) };
  try {
    const list = await wa.listTemplates();
    return { ...base, phone, templatesError: null, templates: rows(new Map(list.map((t) => [`${t.name}|${t.language}`, t]))) };
  } catch (err) {
    return { ...base, phone, templatesError: err instanceof Error ? err.message : String(err), templates: rows(new Map()) };
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

export interface ConnectStep {
  step: 'number' | 'register' | 'webhook' | 'business_account' | 'templates';
  ok: boolean;
  detail: string;
}

/**
 * One-click setup with Meta, run from the admin console on the live deployment (Meta checks the webhook against it):
 * registers the number for the Cloud API if needed, points the app's webhook here, subscribes the app to the
 * business account and submits any templates Meta does not have yet. Each step reports its own result. Audited.
 */
export async function connectWhatsApp(ctx: ServiceContext, actorId: string, opts: { verifyToken: string | undefined; pin?: string }): Promise<ConnectStep[]> {
  const wa = ctx.adapters.whatsapp;
  if (!wa) throw new Error('WhatsApp is not enabled (MESSAGING_DRIVER is mock)');
  const steps: ConnectStep[] = [];
  const run = async (step: ConnectStep['step'], fn: () => Promise<string>) => {
    try {
      steps.push({ step, ok: true, detail: await fn() });
      return true;
    } catch (err) {
      steps.push({ step, ok: false, detail: err instanceof Error ? err.message : String(err) });
      return false;
    }
  };

  let registered = false;
  await run('number', async () => {
    const info = await wa.phoneNumberInfo();
    registered = info.platform_type === 'CLOUD_API';
    return `${info.display_phone_number ?? 'Number'} · ${info.verified_name ?? 'no display name yet'} · ${registered ? 'registered' : 'not registered yet'}`;
  });
  if (!registered) {
    await run('register', async () => {
      if (!opts.pin || !/^\d{6}$/.test(opts.pin)) throw new Error('Enter the six-digit two-step PIN to register the number.');
      await wa.registerPhoneNumber(opts.pin);
      return 'Registered for the WhatsApp Cloud API';
    });
  }
  await run('webhook', async () => {
    if (!opts.verifyToken) throw new Error('WHATSAPP_VERIFY_TOKEN is not set');
    const appId = await wa.appId();
    await wa.subscribeWebhook(appId, `${ctx.publicBaseUrl}/api/webhooks/whatsapp`, opts.verifyToken);
    return `Webhook set to ${ctx.publicBaseUrl}/api/webhooks/whatsapp (messages)`;
  });
  await run('business_account', async () => {
    await wa.subscribeBusinessAccount();
    return 'App subscribed to the WhatsApp Business Account';
  });
  await run('templates', async () => {
    const results = await submitMissingTemplates(ctx, actorId);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) throw new Error(`${results.length - failed.length} submitted, ${failed.length} failed: ${failed[0]!.name}: ${failed[0]!.error}`);
    return results.length ? `${results.length} templates sent to Meta for review` : 'All templates already submitted';
  });
  await audit(ctx, actorId, 'whatsapp.connect', 'whatsapp', null, { steps: steps.map((s) => ({ step: s.step, ok: s.ok })) });
  return steps;
}
