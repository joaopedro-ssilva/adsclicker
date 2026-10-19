// Checks the open/close contract of the Laboratório on a running dev server: L opens, Esc closes, the run only advances
// while the overlay is open and the page is visible. Needs a save in the boss phase (scripts/dev/lab-saves.ts: lab-boss.json).
// Usage: node scripts/qa/lab-contract.mjs <lab-boss.json>
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [saveFile] = process.argv.slice(2);
const base = process.env.QA_BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.addInitScript((value) => window.localStorage.setItem('adsclicker.save', value), readFileSync(saveFile, 'utf8'));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
for (const name of ['Usar a nuvem', 'Depois', 'Coletar', 'Bora clicar!']) {
  await page.getByRole('button', { name }).click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(300);
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const timer = async () => {
  const text = await page.locator('.lab-timer-text').first().textContent({ timeout: 1000 }).catch(() => null);
  return text === null ? null : Number(text.replace(' s', '').replace(',', '.'));
};
const visibility = (state) =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);

check((await page.locator('[data-qa="lab-overlay"]').count()) === 0, 'overlay is closed at the start');
await page.keyboard.press('l');
await page.waitForTimeout(400);
check((await page.locator('[data-qa="lab-overlay"]').count()) === 1, 'L opens the overlay');

const a = await timer();
await page.waitForTimeout(2000);
const b = await timer();
check(a !== null && b !== null && b < a - 1, `the boss timer runs while open (${a} -> ${b})`);

await visibility('hidden');
await page.waitForTimeout(300);
const c = await timer();
await page.waitForTimeout(2000);
const d = await timer();
check(c !== null && d !== null && Math.abs(c - d) < 0.05, `the run pauses while the page is hidden (${c} -> ${d})`);

await visibility('visible');
await page.waitForTimeout(300);
const e = await timer();
await page.waitForTimeout(1500);
const f = await timer();
check(e !== null && f !== null && f < e - 0.8, `the run resumes when visible again (${e} -> ${f})`);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check((await page.locator('[data-qa="lab-overlay"]').count()) === 0, 'Esc closes the overlay');

await page.keyboard.press('l');
await page.waitForTimeout(300);
const g = await timer();
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);
await page.keyboard.press('l');
await page.waitForTimeout(300);
const h = await timer();
check(g !== null && h !== null && Math.abs(g - h) < 0.6, `the run stays paused while closed (${g} -> ${h})`);

await page.locator('[data-qa="lab-close"]').click();
await page.waitForTimeout(300);
check((await page.locator('[data-qa="lab-overlay"]').count()) === 0, 'the X closes the overlay');

await page.keyboard.press('l');
await page.waitForTimeout(300);
await page.keyboard.press('l');
check((await page.locator('[data-qa="lab-overlay"]').count()) === 1, 'L with the overlay open does nothing else');

await browser.close();
process.exitCode = failures.length > 0 ? 1 : 0;
