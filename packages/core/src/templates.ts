import { catalogue } from './i18n/catalogue';
import type { Lang, OutboundMessage } from './messages';

/**
 * Registry of WhatsApp templates (business-initiated messages outside the 24-hour window). Every template here must
 * be submitted to Meta with exactly these names, languages and parameters (utility category). The `body` keys point to
 * the i18n catalogue so the wording is shared with docs/WHATSAPP_TEMPLATES.md and future SMS rendering.
 */
export interface TemplateDef {
  name: string;
  category: 'utility';
  languages: readonly Lang[];
  /** Ordered parameter names for {{1}}, {{2}}, … */
  params: readonly string[];
  bodyKey: string;
  /** Quick-reply buttons: payload prefix + i18n key for the title. */
  buttons: readonly { payload: string; titleKey: string }[];
  /** Optional URL button / link suffix parameter. */
  url?: { param: string };
}

export const TEMPLATES = {
  client_job_confirmation: {
    name: 'sp_client_job_confirmation_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['artisan_first_name', 'job_type', 'job_date', 'rating_link'],
    bodyKey: 'tpl.client_confirmation',
    buttons: [
      { payload: 'cc_yes', titleKey: 'tpl.btn.yes_done' },
      { payload: 'cc_no', titleKey: 'tpl.btn.no' },
      { payload: 'cc_stop', titleKey: 'tpl.btn.stop' },
    ],
    url: { param: 'rating_link' },
  },
  client_job_reminder: {
    name: 'sp_client_job_reminder_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['artisan_first_name', 'job_type', 'job_date', 'rating_link'],
    bodyKey: 'tpl.client_reminder',
    buttons: [
      { payload: 'cc_yes', titleKey: 'tpl.btn.yes_done' },
      { payload: 'cc_no', titleKey: 'tpl.btn.no' },
      { payload: 'cc_stop', titleKey: 'tpl.btn.stop' },
    ],
    url: { param: 'rating_link' },
  },
  artisan_job_update: {
    name: 'sp_artisan_job_update_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['job_ref', 'status_text'],
    bodyKey: 'tpl.artisan_job_update',
    buttons: [{ payload: 'menu_passport', titleKey: 'tpl.btn.my_passport' }],
  },
  artisan_review_result: {
    name: 'sp_artisan_review_result_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['job_ref', 'result_text'],
    bodyKey: 'tpl.artisan_review_result',
    buttons: [{ payload: 'menu_passport', titleKey: 'tpl.btn.my_passport' }],
  },
  artisan_work_request: {
    name: 'sp_artisan_work_request_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['buyer_name', 'area', 'description'],
    bodyKey: 'tpl.artisan_work_request',
    buttons: [
      { payload: 'wr_accept', titleKey: 'tpl.btn.accept' },
      { payload: 'wr_decline', titleKey: 'tpl.btn.decline' },
    ],
  },
  artisan_job_ownership: {
    name: 'sp_artisan_job_ownership_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['agent_name', 'job_type', 'job_ref'],
    bodyKey: 'tpl.artisan_job_ownership',
    buttons: [
      { payload: 'own_yes', titleKey: 'tpl.btn.yes_mine' },
      { payload: 'own_no', titleKey: 'tpl.btn.not_mine' },
    ],
  },
  hire_follow_up: {
    name: 'sp_hire_follow_up_v1',
    category: 'utility',
    languages: ['en', 'sn', 'nd'],
    params: ['other_party', 'description'],
    bodyKey: 'tpl.hire_follow_up',
    buttons: [
      { payload: 'hire_yes', titleKey: 'tpl.btn.job_happened' },
      { payload: 'hire_no', titleKey: 'tpl.btn.job_not_happened' },
    ],
  },
} as const satisfies Record<string, TemplateDef>;

export type TemplateKey = keyof typeof TEMPLATES;


/**
 * Builds a template message. Button payloads become `${payload}:${ref}` so replies carry the entity id.
 * `preview` is the fully rendered body (used by the simulator and SMS later). Meta forbids newlines in parameters,
 * so parameters are flattened.
 */
export function buildTemplate(key: TemplateKey, lang: Lang, params: string[], ref?: string): OutboundMessage {
  const def: TemplateDef = TEMPLATES[key];
  if (params.length !== def.params.length) throw new Error(`Template ${def.name} needs ${def.params.length} params`);
  const flat = params.map((p) => p.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim());
  const body = (catalogue as Record<string, Record<Lang, string>>)[def.bodyKey]![lang];
  const preview = body.replace(/\{(\d)\}/g, (_m, i: string) => flat[Number(i) - 1] ?? '');
  return {
    kind: 'template',
    template: def.name,
    lang,
    params: flat,
    buttons: def.buttons.map((b) => ({
      id: ref ? `${b.payload}:${ref}` : b.payload,
      title: (catalogue as Record<string, Record<Lang, string>>)[b.titleKey]![lang],
    })),
    preview,
  };
}

/** Example values Meta requires for each parameter when a template is submitted for approval (fictional). */
const PARAM_EXAMPLES: Record<string, string> = {
  artisan_first_name: 'Tendai',
  job_type: 'Battery and inverter installation',
  job_date: '12 Nov',
  rating_link: 'https://skillspassport.example/c/abc123',
  job_ref: 'J-7K2QX',
  status_text: 'Your client confirmed the job.',
  result_text: 'A master artisan rated the work as good.',
  buyer_name: 'Kuyedza Builders',
  area: 'Glen View',
  description: 'Install a 3 kVA solar system',
  agent_name: 'Rumbidzai',
  other_party: 'Tendai M.',
};

/** One template in one language, in the shape the WhatsApp Cloud API's message_templates endpoint accepts. */
export interface TemplateSubmission {
  /** Registry key + language, for display. */
  key: TemplateKey;
  lang: Lang;
  /** Name and locale as registered with Meta (chiShona/isiNdebele use a name suffix under the en locale). */
  name: string;
  language: string;
  category: 'UTILITY';
  components: (
    | { type: 'BODY'; text: string; example?: { body_text: string[][] } }
    | { type: 'BUTTONS'; buttons: { type: 'QUICK_REPLY'; text: string }[] }
  )[];
}

/** Every template in every language, ready to submit to Meta for approval. */
export function templateSubmissions(): TemplateSubmission[] {
  const cat = catalogue as Record<string, Record<Lang, string>>;
  const out: TemplateSubmission[] = [];
  for (const [key, def] of Object.entries(TEMPLATES) as [TemplateKey, TemplateDef][]) {
    for (const lang of def.languages) {
      const text = cat[def.bodyKey]![lang].replace(/\{(\d)\}/g, '{{$1}}');
      out.push({
        key,
        lang,
        name: lang === 'en' ? def.name : `${def.name}_${lang}`,
        language: 'en',
        category: 'UTILITY',
        components: [
          { type: 'BODY', text, ...(def.params.length ? { example: { body_text: [def.params.map((p) => PARAM_EXAMPLES[p] ?? p)] } } : {}) },
          ...(def.buttons.length ? [{ type: 'BUTTONS' as const, buttons: def.buttons.map((b) => ({ type: 'QUICK_REPLY' as const, text: cat[b.titleKey]![lang] })) }] : []),
        ],
      });
    }
  }
  return out;
}
