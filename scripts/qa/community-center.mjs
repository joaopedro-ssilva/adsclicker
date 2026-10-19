// Screenshots of the Centro Comunitário on a running dev server, from the save made by scripts/dev/donors-seed.ts.
// Usage: node scripts/qa/community-center.mjs <save.json> <out-dir> --cookie=<session token> [--size=WxH] [--mobile] [--donate]
//   writes <out-dir>/cc-tab-<size>.png (Turma tab with the button) and cc-panel-<size>.png (the open window),
//   plus cc-panel-bottom-<size>.png (scrolled to the end) and, with --donate, cc-donated-<size>.png (after giving 10%)
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [saveFile, outDir = '.', ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => flags.some((f) => f === `--${name}` || f.startsWith(`--${name}=`));
const [width, height] = has('mobile') ? [390, 844] : (flag('size') ?? '1590x820').split('x').map(Number);
const tag = `${width}x${height}`;
mkdirSync(outDir, { recursive: true });

const base = process.env.QA_BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, hasTouch: has('mobile') });
if (flag('cookie')) await context.addCookies([{ name: 'adsclicker_session', value: flag('cookie'), url: base }]);
const page = await context.newPage();
// The local save of the screenshot must not overwrite the seeded player on the server.
await page.route('**/api/sync', (route) => route.abort());
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !/api\/sync|Failed to load resource/.test(message.text())) errors.push(`console: ${message.text()}`);
});

await page.addInitScript((value) => window.localStorage.setItem('adsclicker.save', value), readFileSync(saveFile, 'utf8'));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
for (const name of ['Usar a nuvem', 'Depois', 'Coletar', 'Bora clicar!']) {
  await page.getByRole('button', { name }).click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
}

await page.locator('[data-qa="tab-comunidade"]').first().click({ timeout: 4000 }).catch(() => errors.push('Turma tab not found'));
await page.waitForTimeout(1200);
await page.locator('[data-qa="community-center-open"]').scrollIntoViewIfNeeded().catch(() => errors.push('button not found'));
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, `cc-tab-${tag}.png`) });

await page.locator('[data-qa="community-center-open"]').click({ timeout: 3000 }).catch(() => errors.push('could not open the window'));
await page.waitForTimeout(900);
await page.screenshot({ path: join(outDir, `cc-panel-${tag}.png`) });
await page.locator('dialog[open] .ui-modal-content').evaluate((node) => node.scrollTo(0, node.scrollHeight)).catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, `cc-panel-bottom-${tag}.png`) });
await page.locator('dialog[open] .ui-modal-content').evaluate((node) => node.scrollTo(0, 0)).catch(() => {});

const overflow = await page.evaluate(() => {
  const content = document.querySelector('.ui-modal-content');
  return content ? content.scrollWidth - content.clientWidth : -1;
});
console.log(`horizontal overflow of the window: ${overflow}px`);

if (has('donate')) {
  await page.locator('[data-qa="cc-give"]').click({ timeout: 3000 }).catch(() => errors.push('give button not found'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, `cc-donated-${tag}.png`) });
  await page.locator('[data-qa="cc-preset-100"]').click({ timeout: 2000 }).catch(() => {});
  await page.locator('[data-qa="cc-give"]').click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  console.log('confirm step shown:', await page.locator('[data-qa="cc-confirm"]').count());
  await page.screenshot({ path: join(outDir, `cc-confirm-${tag}.png`) });
}

await browser.close();
if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
  process.exitCode = 1;
}
