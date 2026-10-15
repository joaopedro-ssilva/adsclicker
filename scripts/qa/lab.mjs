// Screenshots of the Laboratório de Pesquisa on a running dev server, from a save made by scripts/dev/lab-saves.ts.
// Usage: node scripts/qa/lab.mjs <save.json> <out.png> [--mobile] [--size=WxH] [--roster] [--tab=progressao] [--wait=ms] [--clicks=N] [--scroll=px]
//   --size    viewport, e.g. 1920x1080 (default 1440x900; --mobile is 390x844)
//   --scroll  scrolls the body of the overlay before the shot (and reports any horizontal scroll)
//   --roster  shoots the classroom with the 9th slot instead of opening the overlay (opens nothing)
//   --clicks  clicks the monitor N times before the shot
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [saveFile, out = 'lab.png', ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => flags.some((f) => f === `--${name}` || f.startsWith(`--${name}=`));

const viewport = () => {
  if (has('mobile')) return { width: 390, height: 844 };
  const [width, height] = (flag('size') ?? '1440x900').split('x').map(Number);
  return { width, height };
};
const base = process.env.QA_BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: viewport(), hasTouch: has('mobile') });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const save = readFileSync(saveFile, 'utf8');
await page.addInitScript((value) => window.localStorage.setItem('adsclicker.save', value), save);
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
for (const name of ['Usar a nuvem', 'Depois', 'Coletar', 'Bora clicar!']) {
  await page.getByRole('button', { name }).click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
}

if (!has('roster')) {
  await page.locator('[data-qa="roster-lab"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('[data-qa="roster-lab"]').first().click({ timeout: 4000 }).catch(() => errors.push('lab slot not found'));
  await page.waitForTimeout(500);
  const tab = flag('tab');
  if (tab) await page.locator(`[data-qa="lab-tab-${tab}"]`).click({ timeout: 2000 }).catch(() => errors.push(`tab ${tab} not found`));
  const clicks = Number(flag('clicks') ?? 0);
  for (let i = 0; i < clicks; i += 1) await page.locator('[data-qa="lab-screen"]').click({ position: { x: 120 + (i % 5) * 40, y: 120 + (i % 3) * 30 }, delay: 5 }).catch(() => {});
}
const scroll = Number(flag('scroll') ?? 0);
if (scroll > 0) await page.evaluate((top) => document.querySelector('.lab-body')?.scrollTo(0, top), scroll);
const horizontal = await page.evaluate(() => {
  const body = document.querySelector('.lab-body');
  return body ? body.scrollWidth - body.clientWidth : 0;
});
if (horizontal > 1) errors.push(`horizontal scroll in the lab: ${horizontal}px`);
await page.waitForTimeout(Number(flag('wait') ?? 400));
await page.screenshot({ path: out });
await browser.close();

if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`ok ${out}`);
}
