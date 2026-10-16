// Screenshots of the Pós-doc on a running dev server, from the save made by scripts/dev/postdoc-saves.ts.
// Usage: node scripts/qa/postdoc.mjs <save.json> <out-dir> [--size=WxH]
//   writes <out-dir>/postdoc-panel.png (Aulas panel), postdoc-dialog.png (confirmation) and postdoc-after.png (after defending)
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [saveFile, outDir = '.', ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (flag('size') ?? '1590x820').split('x').map(Number);
mkdirSync(outDir, { recursive: true });

const base = process.env.QA_BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.addInitScript((value) => window.localStorage.setItem('adsclicker.save', value), readFileSync(saveFile, 'utf8'));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
for (const name of ['Usar a nuvem', 'Depois', 'Coletar', 'Bora clicar!']) {
  await page.getByRole('button', { name }).click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
}

await page.locator('[data-qa="postdoc"]').first().scrollIntoViewIfNeeded().catch(() => errors.push('postdoc row not found'));
await page.screenshot({ path: join(outDir, 'postdoc-panel.png') });

await page.locator('[data-qa="postdoc-open"]').click({ timeout: 3000 }).catch(() => errors.push('open button not found'));
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, 'postdoc-dialog.png') });

await page.locator('[data-qa="postdoc-confirm"]').click({ timeout: 3000 }).catch(() => errors.push('confirm button not found'));
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'postdoc-after.png') });
console.log(await page.locator('[data-qa="postdoc"]').first().innerText().catch(() => '(no row)'));

await browser.close();
if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
  process.exitCode = 1;
}
