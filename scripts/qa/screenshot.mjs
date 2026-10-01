// Takes screenshots of a running dev/prod server for visual review.
// Usage: node scripts/qa/screenshot.mjs <url-path> <out-file> [--mobile] [--clicks=N] [--wait=ms] [--save=<file.json>]
//   --clicks  clicks the element marked data-qa="clicker" N times before the shot
//   --save    preloads localStorage "adsclicker.save" from a file before the page boots
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [path = '/', out = 'shot.png', ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((f) => f === `--${name}` || f.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => flags.some((f) => f === `--${name}` || f.startsWith(`--${name}=`));

const base = process.env.QA_BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: has('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const saveFile = flag('save');
if (saveFile) {
  const save = readFileSync(saveFile, 'utf8');
  await page.addInitScript((value) => window.localStorage.setItem('adsclicker.save', value), save);
}

await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(flag('wait') ?? 800));

const clicks = Number(flag('clicks') ?? 0);
if (clicks > 0) {
  const target = page.locator('[data-qa="clicker"]').first();
  for (let i = 0; i < clicks; i += 1) await target.click({ delay: 5 });
  await page.waitForTimeout(300);
}

await page.screenshot({ path: out, fullPage: has('full') });
await browser.close();

if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`ok ${out}`);
}
