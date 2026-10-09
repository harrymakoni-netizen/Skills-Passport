/* eslint-disable no-console -- CLI script that prints a report */
/** AI evaluation harness (SPEC §13): precision/recall of competency suggestions per trade on fixtures/eval. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdapters } from '@sp/adapters';
import { loadEnv } from '@sp/config';
import { JOB_STRUCTURING_SCHEMA, PROMPT_ID, PROMPT_VERSION, systemPrompt } from './prompts/job-structuring.v1';
import { aiOutputSchema, redactForAi } from './services/ai';
import { TRADES } from './seed-data';

const env = loadEnv();
const { llm } = createAdapters(env, null);
const dir = join(import.meta.dirname, '../../../fixtures/eval');
const MIN_CONFIDENCE = 0.8;

for (const tradeDir of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  let tp = 0, fp = 0, fn = 0, jobs = 0;
  for (const f of readdirSync(join(dir, tradeDir.name)).filter((x) => x.endsWith('.json'))) {
    const job = JSON.parse(readFileSync(join(dir, tradeDir.name, f), 'utf8')) as { jobTypeKey: string; transcript: string; notes: string[]; labels: string[] };
    const trade = TRADES.find((t) => t.jobTypes.some((j) => j.key === job.jobTypeKey))!;
    const jt = trade.jobTypes.find((j) => j.key === job.jobTypeKey)!;
    const res = await llm.generateJson({
      promptId: PROMPT_ID, promptVersion: PROMPT_VERSION,
      system: systemPrompt({ trade: trade.en, jobType: jt.name, jobTypeKey: jt.key, units: trade.units.map((u) => ({ code: u.code, title: u.title, evidenceGuidance: u.evidence })) }),
      user: `Voice note transcript:\n${redactForAi(job.transcript)}`,
      jsonSchema: JOB_STRUCTURING_SCHEMA, fixtureKey: job.jobTypeKey, allowedUnits: trade.units.map((u) => u.code),
    });
    const out = aiOutputSchema.parse(res.json);
    const predicted = new Set(out.suggested_units.filter((u) => u.confidence >= MIN_CONFIDENCE).map((u) => u.code));
    const truth = new Set(job.labels);
    for (const p of predicted) {
      if (truth.has(p)) tp++;
      else fp++;
    }
    for (const t of truth) if (!predicted.has(t)) fn++;
    jobs++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  console.log(`${tradeDir.name.padEnd(10)} jobs ${jobs}  precision ${(precision * 100).toFixed(0)}%  recall ${(recall * 100).toFixed(0)}%  ${precision >= 0.8 ? 'OK to show suggestions' : 'below 80% — keep suggestions hidden'}`);
}
