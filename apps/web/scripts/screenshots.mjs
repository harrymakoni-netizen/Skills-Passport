// Captures every page at 360 px and 1280 px into docs/screenshots (design self-review, CLAUDE.md).
// Usage: pnpm --filter @sp/web screenshots   (needs api, worker and web running, and the demo seed)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = join(import.meta.dirname, '../../../docs/screenshots');
const WIDTHS = (process.env.WIDTHS ?? '360,1280').split(',').map(Number);
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function login(ctx, email) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  const r = await page.evaluate(async (email) => {
    const post = (p, b) => fetch(`/api${p}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sp-csrf': '1' }, body: JSON.stringify(b) }).then((x) => x.json());
    const a = await post('/auth/login', { email, password: 'passport-demo-2026' });
    if (a.next === 'done') return a;
    const { code } = await fetch(`/api/auth/dev-code?challenge=${encodeURIComponent(a.challenge)}`).then((x) => x.json());
    return post('/auth/totp', { challenge: a.challenge, code });
  }, email);
  await page.close();
  if (r.next !== 'done') throw new Error(`login failed for ${email}`);
}

const groups = [
  { as: null, pages: [['home', '/'], ['find', '/find'], ['passport-silver', '/p/SP-HRE-00001'], ['passport-bronze-sn', '/p/SP-HRE-00002?lang=sn'], ['passport-starter', '/p/SP-BYO-00001'], ['login', '/login'], ['design', '/dev/design'], ['simulator', '/dev/chat']] },
  { as: 'farai.verifier@skillspassport.test', pages: [['verifier-queue', '/verifier'], ['verifier-history', '/verifier/history']] },
  { as: 'sipho.verifier@skillspassport.test', pages: [['verifier-queue-flagged', '/verifier']] },
  { as: 'rumbi.agent@skillspassport.test', pages: [['agent-tasks', '/agent'], ['agent-log', '/agent/log?code=SP-HRE-00002'], ['agent-enrol', '/agent/enrol']] },
  { as: 'buyer@kuyedza.test', pages: [['buyer-directory', '/buyer'], ['buyer-requests', '/buyer/requests']] },
  { as: 'admin@skillspassport.test', pages: [['admin-overview', '/admin'], ['admin-flags', '/admin/flags'], ['admin-artisans', '/admin/artisans'], ['admin-frameworks', '/admin/frameworks'], ['admin-config', '/admin/config'], ['admin-people', '/admin/people'], ['admin-report', '/admin/report'], ['admin-audit', '/admin/audit']] },
];

for (const g of groups) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 800 : 900 }, deviceScaleFactor: w < 600 ? 2 : 1 });
    if (g.as) await login(ctx, g.as);
    for (const [name, path] of g.pages) {
      if (only && !name.startsWith(only)) continue;
      const page = await ctx.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(name === 'simulator' ? 2500 : 600);
      await page.screenshot({ path: join(OUT, `${name}-${w}.png`), fullPage: name !== 'simulator' });
      await page.close();
      console.log(`✓ ${name}-${w}`);
    }
    await ctx.close();
  }
}
// The client confirmation page needs a live token: take the newest one from the dev state endpoint.
const state = await fetch(`${BASE}/api/dev/state`).then((r) => r.json()).catch(() => null);
if (state?.latestJob?.ratingUrl && (!only || 'confirm'.startsWith(only))) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: w < 600 ? 2 : 1 });
    await page.goto(state.latestJob.ratingUrl.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, `confirm-${w}.png`), fullPage: true });
    await page.close();
    console.log(`✓ confirm-${w}`);
  }
}
await browser.close();
