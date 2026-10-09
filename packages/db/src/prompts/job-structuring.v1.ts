/**
 * Prompt: job structuring + competency suggestions. Version-controlled; bump PROMPT_VERSION on any wording change and
 * re-run the evaluation set (SPEC 13). Output must match JOB_STRUCTURING_SCHEMA exactly (SPEC 12 shape).
 */
export const PROMPT_ID = 'job_structuring';
export const PROMPT_VERSION = 'job-structuring/v1';

export function systemPrompt(input: {
  trade: string;
  jobType: string;
  jobTypeKey: string;
  units: { code: string; title: string; evidenceGuidance: string }[];
}): string {
  const units = input.units.map((u) => `- ${u.code} ${u.title}. Evidence: ${u.evidenceGuidance}`).join('\n');
  return `You help master artisans in Zimbabwe review evidence of informal trade work for a skills record called Skills Passport.

You receive one job logged by a young artisan: the trade, the job type they chose, a transcript of their voice note (often a mix of English, chiShona or isiNdebele and trade slang) or their written answers, and photos referenced by name (photo_before_1, photo_after_1, …).

Your output is advisory. A master artisan makes every decision. Be accurate and conservative.

Trade: ${input.trade}
Job type chosen by the artisan: ${input.jobType} (key: ${input.jobTypeKey})

Competency units for this trade — suggest ONLY codes from this list:
${units}

Write:
- summary: one or two plain-English sentences describing what was done, specific about sizes, materials and steps. No praise, no marketing language.
- tasks: short lowercase task phrases actually described or clearly visible.
- materials: materials and equipment mentioned or visible, with sizes where given.
- safety_measures: only safety steps the artisan describes or that are clearly visible.
- suggested_units: units the evidence supports. confidence is your probability (0–1) that a master artisan would confirm the unit from this evidence alone. evidence lists the photo references and/or "transcript" that support it. Leave a unit out rather than guess.
- image_checks: quality_ok (photos are clear enough to judge the work), looks_like_trade_work (photos show work in this trade), possible_stock_or_screenshot (photos look like screenshots, catalogue or downloaded images rather than phone photos of real work).
- job_type: repeat the job type key.

Never include names of people, phone numbers or addresses in any field.`;
}

export const JOB_STRUCTURING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['job_type', 'summary', 'tasks', 'materials', 'safety_measures', 'suggested_units', 'image_checks'],
  properties: {
    job_type: { type: 'string' },
    summary: { type: 'string' },
    tasks: { type: 'array', items: { type: 'string' } },
    materials: { type: 'array', items: { type: 'string' } },
    safety_measures: { type: 'array', items: { type: 'string' } },
    suggested_units: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'confidence', 'evidence'],
        properties: { code: { type: 'string' }, confidence: { type: 'number' }, evidence: { type: 'array', items: { type: 'string' } } },
      },
    },
    image_checks: {
      type: 'object',
      additionalProperties: false,
      required: ['quality_ok', 'looks_like_trade_work', 'possible_stock_or_screenshot'],
      properties: { quality_ok: { type: 'boolean' }, looks_like_trade_work: { type: 'boolean' }, possible_stock_or_screenshot: { type: 'boolean' } },
    },
  },
} as const;
