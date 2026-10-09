/** Writes docs/WHATSAPP_TEMPLATES.md from the template registry and catalogue. Run: pnpm --filter @sp/core templates:doc */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogue } from '../src/i18n/catalogue';
import { TEMPLATES } from '../src/templates';

const cat = catalogue as Record<string, { en: string; sn: string; nd: string; needsReview?: boolean }>;
const names = { en: 'English', sn: 'chiShona', nd: 'isiNdebele' } as const;
let md = `# WhatsApp message templates

Generated from \`packages/core/src/templates.ts\` and the i18n catalogue by \`pnpm --filter @sp/core templates:doc\` — do not
edit by hand. Submit each template to Meta (WhatsApp Manager → Message templates) in the **Utility** category.

Meta does not offer chiShona or isiNdebele as template languages, so those versions are submitted under the **English
(en)** locale with a language suffix on the name (\`…_sn\`, \`…_nd\`). The adapter picks the right name automatically
(\`templateNameAndLocale\` in \`packages/adapters/src/messaging/whatsapp.ts\`).

Parameters are \`{{1}}\`, \`{{2}}\`… in order. Quick-reply button payloads are set at send time as \`<payload>:<id>\`.
chiShona and isiNdebele wording is a draft for native-speaker review before submission.

`;
for (const t of Object.values(TEMPLATES)) {
  md += `## \`${t.name}\`\n\nParameters: ${t.params.map((p, i) => `\`{{${i + 1}}}\` ${p}`).join(', ')}\n\n`;
  md += `| Language | Template name | Body | Quick replies |\n| --- | --- | --- | --- |\n`;
  for (const l of t.languages) {
    const body = cat[t.bodyKey]![l].replace(/\{(\d)\}/g, '{{$1}}').replace(/\n/g, '<br>');
    const buttons = t.buttons.map((b) => `${cat[b.titleKey]![l]} (\`${b.payload}\`)`).join('<br>');
    md += `| ${names[l]} | \`${l === 'en' ? t.name : `${t.name}_${l}`}\` | ${body} | ${buttons} |\n`;
  }
  md += '\n';
}
writeFileSync(join(import.meta.dirname, '../../../docs/WHATSAPP_TEMPLATES.md'), md);
console.log('wrote docs/WHATSAPP_TEMPLATES.md');
