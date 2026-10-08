// Throwaway: mocks the Hackathon profile (rich account) and every spending POST, then shoots Itens / Habilidades / Mentores.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { hackathonContent as HK } from '@/hackathon/content';
import { computeBuild } from '@/hackathon/engine';

const mobile = process.argv.includes('--mobile');
const prefix = `art/preview/hx-b-mock${mobile ? '-m' : ''}`;
const S = 'C:/Users/JOAOPE~1/AppData/Local/Temp/claude/c--Users-joaopedro-Documents-Workspace---2026-Ed-cio-Clicker-Remastered/e3cba4e3-a53d-49c1-92b5-5d9a6aa7acec/scratchpad';
const state = `${S}/state-${mobile ? 'mobile' : 'desktop'}.json`;

const RAR = ['comum', 'incomum', 'raro', 'epico', 'lendario'] as const;
const sequence = [4, 3, 3, 2, 2, 2, 1, 1, 0, 0, 0, 0];
const items = Array.from({ length: 37 }, (_, i) => {
  const base = HK.items[i % HK.items.length];
  const rarity = RAR[sequence[i % sequence.length]];
  const count = Math.min(4, 1 + sequence[i % sequence.length]);
  const defs = [base.primary, ...base.pool].slice(0, count);
  const affixes = defs.map((d, k) => {
    const quality = (k * 37 + i * 13) % 100;
    return { target: d.target, op: d.op, value: Math.round((d.min + ((d.max - d.min) * quality) / 100) * 10) / 10, quality };
  });
  return { id: `it${i}`, base: base.id, rarity, level: 1 + (i % 9), affixes, quality: 40 + ((i * 7) % 55), rerolls: i % 3 === 0 ? 1 : 0, createdAt: 1_700_000_000_000 + i * 1000 };
});

const P: any = {
  commits: 4200,
  level: 12,
  items,
  skillNodes: { algoritmos: 3, 'deploy-continuo': 1, atalhos: 1 },
  freeSkillPoints: 5,
  activeSkills: ['deploy'],
  mentors: Object.fromEntries(HK.mentors.map((m, i) => [m.professor, { level: [2, 1, 5, 0, 3, 0, 0, 0][i], unlocked: i < 6 }])),
  equipped: { ferramenta: 'it0', setup: null, acessorio: null, amuleto: null },
  collection: HK.items.slice(0, 14).map((b) => b.id),
};
const rebuild = (p: any) => {
  const mentors: any = {};
  for (const [id, m] of Object.entries<any>(p.mentors)) mentors[id] = m.level;
  const byId = new Map(p.items.map((x: any) => [x.id, x]));
  const equipped: any = {};
  for (const [slot, id] of Object.entries<any>(p.equipped)) if (id && byId.get(id)) equipped[slot] = byId.get(id);
  p.build = computeBuild({ cargo: p.cargo, level: p.level, skillNodes: p.skillNodes, mentors, equipped, activeSkills: p.activeSkills }, HK);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  storageState: existsSync(state) ? state : undefined,
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
const posts: string[] = [];
let real: any = null;

await page.route('**/api/hackathon/profile', async (route) => {
  if (route.request().method() !== 'GET') return route.continue();
  const res = await route.fetch();
  const json = await res.json();
  real = json;
  Object.assign(json.profile, P, { cargo: json.profile.cargo });
  P.cargo = json.profile.cargo;
  rebuild(json.profile);
  Object.assign(P, { stages: json.profile.stages, cafe: json.profile.cafe, xp: json.profile.xp, xpToNext: json.profile.xpToNext, head: json.profile.head, pity: 0, daily: json.profile.daily, totals: json.profile.totals });
  await route.fulfill({ response: res, json });
});
await page.route('**/api/hackathon/{equip,skills,mentors,items}', async (route) => {
  const url = route.request().url();
  const body = route.request().postDataJSON();
  posts.push(`${url.split('/').pop()} ${JSON.stringify(body)}`);
  if (url.endsWith('/equip')) P.equipped[body.slot] = body.itemId;
  if (url.endsWith('/skills')) {
    if (body.action === 'buy') {
      const node = HK.skillNodes.find((n) => n.id === body.node)!;
      P.skillNodes[body.node] = (P.skillNodes[body.node] ?? 0) + 1;
      P.freeSkillPoints -= node.cost;
    } else if (body.action === 'respec') {
      P.skillNodes = {};
      P.freeSkillPoints = P.level - 1;
      P.activeSkills = [];
      P.commits -= HK.config.respecCommits;
    } else P.activeSkills = body.skills;
  }
  if (url.endsWith('/mentors')) {
    const m = HK.mentors.find((x) => x.professor === body.professor)!;
    const lvl = P.mentors[body.professor].level;
    P.commits -= m.costs[lvl];
    P.mentors[body.professor].level += 1;
  }
  if (url.endsWith('/items')) {
    if (body.action === 'recycle') {
      P.items = P.items.filter((x: any) => !body.itemIds.includes(x.id));
      P.commits += 10 * body.itemIds.length;
    } else {
      const it = P.items.find((x: any) => x.id === body.itemId);
      it.affixes[body.affixIndex].value += 1;
      it.rerolls += 1;
      P.commits -= 50;
    }
  }
  const profile = { ...(real?.profile ?? {}), ...P };
  rebuild(profile);
  await route.fulfill({ json: { profile } });
});

if (existsSync(`${S}/save.json`)) {
  const save = readFileSync(`${S}/save.json`, 'utf8');
  await page.addInitScript((v) => { if (!localStorage.getItem('adsclicker.save')) localStorage.setItem('adsclicker.save', v); }, save);
}
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
for (const name of ['Usar a nuvem', 'Depois']) await page.getByRole('button', { name }).click({ timeout: 1200 }).catch(() => {});
await page.locator('[data-qa="mode-switch"]').click();
await page.waitForTimeout(1500);
const tab = async (t: string) => { await page.locator(`[data-qa="hk-tab-${t}"]:visible`).first().click(); await page.waitForTimeout(500); };
const shot = async (n: string) => { await page.waitForTimeout(300); await page.screenshot({ path: `${prefix}-${n}.png`, fullPage: mobile }); };

// Items
await tab('itens');
await shot('itens-empty');
await page.locator('[data-qa="hk-item-it0"]').click(); // equipped legendary
await shot('itens-equipped');
await page.locator('[data-qa="hk-item-it3"]').click(); // epic or legendary, not equipped
await shot('itens-detail');
if (mobile) await page.locator('[data-qa="hk-detail"]').scrollIntoViewIfNeeded().catch(() => {});
await page.locator('[data-qa="hk-reroll-1"]').click();
await page.waitForTimeout(300);
await shot('itens-reroll-confirm');
await page.locator('[data-qa="hk-reroll-confirm"]').click();
await page.waitForTimeout(600);
await shot('itens-after-reroll');
await page.locator('[data-qa="hk-recycle"]').click();
await page.waitForTimeout(300);
await shot('itens-recycle-confirm');
await page.locator('[data-qa="hk-recycle-confirm"]').click().catch(() => {});
await page.waitForTimeout(600);
await page.locator('[data-qa="hk-select-mode"]').click();
for (const id of ['it8', 'it9', 'it10']) await page.locator(`[data-qa="hk-item-${id}"]`).click();
await shot('itens-select');
await page.locator('[data-qa="hk-recycle-selected"]').click();
await page.waitForTimeout(300);
await shot('itens-bulk-confirm');
await page.locator('[data-qa="hk-recycle-all-confirm"]').click();
await page.waitForTimeout(600);
await page.locator('[data-qa="hk-view-colecao"]').click();
await shot('itens-colecao');

// Skills
await tab('habilidades');
await shot('skills');
await page.locator('[data-qa="hk-node-cafeina"]').click();
await shot('skills-locked');
await page.locator('[data-qa="hk-node-atalhos"]').click();
await page.locator('[data-qa="hk-node-buy"]').click();
await page.waitForTimeout(500);
await shot('skills-bought');
await page.locator('[data-qa="hk-respec"]').click();
await page.waitForTimeout(300);
await shot('skills-respec');
await page.locator('[data-qa="hk-respec-confirm"]').click();
await page.waitForTimeout(600);
await shot('skills-after-respec');

// Mentors
await tab('mentores');
await shot('mentors');
await page.locator('[data-qa="hk-mentor-buy-edecio"]').click();
await page.waitForTimeout(600);
await shot('mentors-bought');

await browser.close();
console.log('posts:\n' + posts.join('\n'));
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 15).join('\n')}` : 'no browser errors');
