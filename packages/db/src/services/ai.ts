import { checkCaptureDate, checkSuspectImage, t, type ImageChecks } from '@sp/core';
import { LlmRefusalError, type LlmImage } from '@sp/adapters';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { JOB_STRUCTURING_SCHEMA, PROMPT_ID, PROMPT_VERSION, systemPrompt } from '../prompts/job-structuring.v1';
import type { ServiceContext } from './context';
import { raiseFlag } from './fraud';
import { notify } from './outbound';
import { localized } from './reference';

export const aiOutputSchema = z.object({
  job_type: z.string(),
  summary: z.string().min(1),
  tasks: z.array(z.string()),
  materials: z.array(z.string()),
  safety_measures: z.array(z.string()),
  suggested_units: z.array(z.object({ code: z.string(), confidence: z.number().min(0).max(1), evidence: z.array(z.string()) })),
  image_checks: z.object({ quality_ok: z.boolean(), looks_like_trade_work: z.boolean(), possible_stock_or_screenshot: z.boolean() }),
});
export type AiOutput = z.infer<typeof aiOutputSchema> & { model_version: string; prompt_version: string };

/** Removes phone numbers before anything is sent to an AI provider (CLAUDE.md privacy rule). */
export function redactForAi(text: string): string {
  return text.replace(/(\+?\d[\d\s-]{7,}\d)/g, '[number]');
}

/** SPEC 13: transcription, structuring, competency suggestions and image checks for one job. */
export async function processJobAi(ctx: ServiceContext, jobId: string, attempt = 0): Promise<void> {
  const job = await ctx.prisma.job.findUnique({
    where: { id: jobId },
    include: { media: { orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }], include: { transcript: true } }, jobType: true, trade: { include: { units: { where: { active: true }, orderBy: { code: 'asc' } } } }, artisan: true },
  });
  if (!job || job.aiStatus === 'done') return;
  if (job.media.some((m) => m.status !== 'done')) {
    if (attempt < 20) await ctx.queue.enqueue('ai.process', { jobId, attempt: attempt + 1 }, { delayMs: 3000 });
    return;
  }
  const { stt, llm, storage } = ctx.adapters;

  // 1. Speech to text
  const transcripts: string[] = [];
  for (const m of job.media.filter((x) => x.kind === 'voice')) {
    if (m.transcript) {
      transcripts.push(m.transcript.text);
      continue;
    }
    const audio = await storage.get('private', m.originalKey!);
    const r = await stt.transcribe({
      audio,
      mimeType: m.mimeType,
      languageHint: job.artisan.language,
      vocabulary: job.trade.units.map((u) => localized(u.title).en).join(', '),
      fixtureKey: job.jobType.key,
    });
    await ctx.prisma.transcript.create({ data: { jobMediaId: m.id, language: r.language, text: r.text, confidence: r.confidence, modelVersion: r.modelVersion } });
    transcripts.push(r.text);
  }

  // 2. Photos with pseudonymous references
  const photos = job.media.filter((m) => (m.kind === 'photo_before' || m.kind === 'photo_after') && m.publicKey && !m.duplicateOfId);
  const counters = { photo_before: 0, photo_after: 0 } as Record<string, number>;
  const images: LlmImage[] = [];
  for (const p of photos.slice(0, 6)) {
    counters[p.kind] = (counters[p.kind] ?? 0) + 1;
    images.push({ data: await storage.get('public', p.publicKey!), mimeType: 'image/jpeg', ref: `${p.kind}_${counters[p.kind]}` });
  }

  const evidenceText = [
    transcripts.length ? `Voice note transcript:\n${transcripts.map(redactForAi).join('\n---\n')}` : '',
    job.notes.length ? `Written answers:\n${job.notes.map(redactForAi).join('\n')}` : '',
    `Photo references: ${images.map((i) => i.ref).join(', ') || 'none'}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const allowed = job.trade.units.map((u) => u.code);
  const system = systemPrompt({
    trade: job.trade.nameEn,
    jobType: localized(job.jobType.name).en,
    jobTypeKey: job.jobType.key,
    units: job.trade.units.map((u) => ({ code: u.code, title: localized(u.title).en, evidenceGuidance: u.evidenceGuidance })),
  });

  // 3. Structured output, validated; retry once, then manual review (PROMPTS M4).
  let output: AiOutput | null = null;
  for (let i = 0; i < 2 && !output; i++) {
    try {
      const res = await llm.generateJson({ promptId: PROMPT_ID, promptVersion: PROMPT_VERSION, system, user: evidenceText, images, jsonSchema: JOB_STRUCTURING_SCHEMA, fixtureKey: job.jobType.key, allowedUnits: allowed });
      const parsed = aiOutputSchema.safeParse(res.json);
      if (parsed.success) output = { ...parsed.data, model_version: res.modelVersion, prompt_version: res.promptVersion };
      else ctx.log.warn({ jobId, issues: parsed.error.issues.length }, 'AI output failed validation');
    } catch (err) {
      if (err instanceof LlmRefusalError) break;
      if (i === 1) throw err;
    }
  }
  if (!output) {
    await ctx.prisma.job.update({ where: { id: jobId }, data: { aiStatus: 'manual_review' } });
    return;
  }
  output.suggested_units = output.suggested_units.filter((u) => allowed.includes(u.code));

  // 4. Store suggestions (advisory only) and flags.
  const unitByCode = new Map(job.trade.units.map((u) => [u.code, u.id]));
  await ctx.prisma.$transaction([
    ctx.prisma.job.update({ where: { id: jobId }, data: { aiSummary: output as unknown as Prisma.InputJsonValue, aiStatus: 'done' } }),
    ...output.suggested_units.map((u) =>
      ctx.prisma.jobCompetency.upsert({
        where: { jobId_unitId_source: { jobId, unitId: unitByCode.get(u.code)!, source: 'ai' } },
        create: { jobId, unitId: unitByCode.get(u.code)!, source: 'ai', confidence: u.confidence, evidence: u.evidence, status: 'suggested' },
        update: { confidence: u.confidence, evidence: u.evidence },
      }),
    ),
  ]);
  const suspect = checkSuspectImage(output.image_checks as ImageChecks);
  if (suspect && images.length) await raiseFlag(ctx, suspect, jobId);
  const { params: config } = await ctx.config();
  if (job.jobDate) {
    for (const p of photos) {
      const f = checkCaptureDate({ capturedAt: p.capturedAt, jobDate: job.jobDate }, config);
      if (f) await raiseFlag(ctx, f, jobId);
    }
  }

  // 5. Let the artisan check the description (PLAN Q1).
  const summary = output.summary;
  await notify(
    ctx,
    { kind: 'artisan', id: job.artisanId },
    (l) => [
      {
        kind: 'buttons',
        body: t(l, 'sum.check', { ref: job.ref, summary }),
        buttons: [
          { id: `sum_ok:${jobId}`, title: t(l, 'sum.btn.ok') },
          { id: `sum_fix:${jobId}`, title: t(l, 'sum.btn.fix') },
        ],
      },
    ],
    { purpose: 'ai_summary_check', relatedEntity: 'job', relatedId: jobId, ref: job.ref },
  );
}

export async function confirmSummary(ctx: ServiceContext, jobId: string) {
  const job = await ctx.prisma.job.update({ where: { id: jobId }, data: { summaryConfirmedAt: ctx.now() } });
  return { ref: job.ref };
}

/** Artisan correction (text or voice) — kept separately from the AI output, which is never overwritten. */
export async function correctSummary(ctx: ServiceContext, jobId: string, correction: { text: string } | { providerMediaId: string; mimeType: string }) {
  const job = await ctx.prisma.job.findUnique({ where: { id: jobId }, include: { jobType: true, artisan: true } });
  if (!job) return null;
  let text: string;
  if ('text' in correction) text = correction.text;
  else {
    const { data, mimeType } = await ctx.adapters.channel.downloadMedia(correction.providerMediaId);
    const key = `originals/${jobId}/correction-${Date.now()}.ogg`;
    await ctx.adapters.storage.put('private', key, data, { contentType: mimeType });
    text = (await ctx.adapters.stt.transcribe({ audio: data, mimeType, languageHint: job.artisan.language, fixtureKey: job.jobType.key })).text;
  }
  await ctx.prisma.job.update({ where: { id: jobId }, data: { artisanSummary: { summary: text.slice(0, 1000), source: 'text' in correction ? 'text' : 'voice', at: ctx.now().toISOString() }, summaryConfirmedAt: ctx.now() } });
  return { ref: job.ref };
}
