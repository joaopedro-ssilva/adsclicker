// Screenshots of the Hackathon screens on a running dev server, for visual review.
// Usage: node scripts/qa/hackathon.mjs <out-prefix> [--mobile] [--tabs=aluno,itens,habilidades,mentores,fases] [--click=<selector>] [--wait=ms]
//   QA_STATE  Playwright storage state of a logged-in account that already has a student (cookies)
//   QA_SAVE   classroom save preloaded into localStorage "adsclicker.save" when the browser has none
//   --click   clicks a selector after opening each tab and before the shot (e.g. an item cell)
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [prefix = 'hackathon', ...flags] = process.argv.slice(2);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => flags.some((f) => f === `--${name}` || f.startsWith(`--${name}=`));

const base = process.env.QA_BASE ?? 'http://localhost:3000';
const state = process.env.QA_STATE;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: has('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  storageState: state && existsSync(state) ? state : undefined,
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

if (process.env.QA_SAVE) {
  const save = readFileSync(process.env.QA_SAVE, 'utf8');
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('adsclicker.save')) window.localStorage.setItem('adsclicker.save', value);
  }, save);
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
for (const name of ['Usar a nuvem', 'Depois']) {
  await page.getByRole('button', { name }).click({ timeout: 1200 }).catch(() => {});
}
await page.locator('[data-qa="mode-switch"]').click();
await page.waitForTimeout(1500);

const tabs = (flag('tabs') ?? 'aluno,itens,habilidades,mentores,fases').split(',');
for (const tab of tabs) {
  await page.locator(`[data-qa="hk-tab-${tab}"]:visible`).first().click({ timeout: 3000 }).catch(() => errors.push(`tab ${tab} not found`));
  await page.waitForTimeout(500);
  const click = flag('click');
  if (click) await page.locator(click).first().click({ timeout: 2000 }).catch(() => errors.push(`click ${click} failed`));
  await page.waitForTimeout(Number(flag('wait') ?? 400));
  await page.screenshot({ path: `${prefix}-${tab}.png`, fullPage: has('full') });
}
await browser.close();

if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`ok ${prefix}-{${tabs.join(',')}}.png`);
}
