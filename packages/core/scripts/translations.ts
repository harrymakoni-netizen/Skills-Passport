/**
 * Translation review round-trip for native speakers.
 *   export: pnpm --filter @sp/core translations export   → docs/translations-review.csv (key,en,sn,nd)
 *   import: pnpm --filter @sp/core translations import <file.csv>  → prints a patch report; reviewed rows are written to
 *           src/i18n/reviewed.json, which overrides drafts at runtime and clears needsReview.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entriesNeedingReview } from '../src/i18n';

const root = join(import.meta.dirname, '..');
const csvPath = join(root, '../../docs/translations-review.csv');
const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(cur), (cur = '');
    else if (c === '\n') row.push(cur), rows.push(row), (row = []), (cur = '');
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) row.push(cur), rows.push(row);
  return rows;
}

const [cmd, file] = process.argv.slice(2);
if (cmd === 'export') {
  const rows = entriesNeedingReview();
  writeFileSync(csvPath, ['key,en,sn,nd', ...rows.map((r) => [r.key, r.en, r.sn, r.nd].map(esc).join(','))].join('\n') + '\n');
  console.log(`wrote ${rows.length} rows to docs/translations-review.csv`);
} else if (cmd === 'import' && file) {
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (header?.join(',') !== 'key,en,sn,nd') throw new Error('Expected header key,en,sn,nd');
  const out = join(root, 'src/i18n/reviewed.json');
  const reviewed: Record<string, { sn: string; nd: string }> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
  let n = 0;
  for (const [key, , sn, nd] of rows) if (key && sn && nd) (reviewed[key] = { sn, nd }), n++;
  writeFileSync(out, JSON.stringify(reviewed, null, 2) + '\n');
  console.log(`imported ${n} reviewed rows into src/i18n/reviewed.json`);
} else {
  console.log('usage: translations export | import <file.csv>');
}
