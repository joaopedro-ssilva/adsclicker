// Builds a "dev account" save with everything unlocked, to look at late-game screens.
// Usage: npm run dev:save   →   writes dev-save.txt; paste its contents in Config → Importar save.
// Everything comes from the content lists, so new skins, sceneries, themes and achievements are included by themselves.
import { writeFileSync } from 'node:fs';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Decimal, createInitialState, exportSave } from '@/game/engine';

const now = Date.now();
const state = createInitialState(content, now);

state.coins = new Decimal('1e45');
state.runCoins = new Decimal('1e45');
state.lifetimeCoins = new Decimal('1e46');
state.diplomas = 5000;
state.diplomasEarned = 5000;

for (const id of PROFESSOR_IDS) state.hired[id] = true;
for (const discipline of content.disciplines) state.levels[discipline.id] = 400; // past the last strong milestone, and enough for the Domínio cap
for (const upgrade of content.clickUpgrades) state.levels[upgrade.id] = 400;
for (const research of content.research) state.research[research.id] = true;
for (const node of content.prestigeNodes) state.prestige[node.id] = node.maxLevel;
state.buyAmount = 'max';

// Honoured professor: one is honoured now and every professor was honoured before.
state.honoured = 'edecio';
for (const id of PROFESSOR_IDS) state.honouredBefore[id] = true;
for (const ability of content.abilities) state.abilitiesTried[ability.id] = true;

// All eight Maestrias, unlocked (a slot each, from the graduations below) and at level 5.
for (const id of PROFESSOR_IDS) {
  if (content.maestrias.defs[id].built) state.maestria.levels[id] = 5;
}
state.maestria.swarm.since = now - 3 * 3600_000; // the Super invasão starts charged
state.maestria.rollforward.charges = 3;
state.maestria.festa.since = now - 3600_000; // the Festa de lançamento starts recharged
state.run.sprintsCompleted = 40; // B1 Releases: version 10 shipped
state.maestria.horas = { clicks: 20, invasions: 20, sprints: 20, abilities: 20, levels: 20 }; // Angelo: every band filled

// Every Monitor hired at its top level and switched on.
for (const monitor of content.monitors) state.monitors.units[monitor.id] = { level: monitor.levels.length, on: true, nextAt: 0, done: 0, last: '' };

for (const achievement of content.achievements) {
  state.achievements[achievement.id] = now;
  if (achievement.condition.kind === 'secret') state.secrets[achievement.condition.trigger] = true;
}
for (const skin of content.skins) state.skins[skin.id] = true;
for (const scenery of content.sceneries) state.sceneries[scenery.id] = true;
for (const theme of content.themes) state.themes[theme.id] = true;

Object.assign(state.counters, {
  clicks: 1_500_000,
  crits: 9_000,
  maxCombo: 60,
  eventsDefended: 400,
  bestEventStreak: 120,
  biggestPurchase: 500,
  bestDayStreak: 7,
  abilitiesUsed: 1_200,
  sprintsCompleted: 150,
  levelsBought: 6_000,
  researchBought: content.research.length,
  graduations: 30,
  playSeconds: 40 * 3600,
  goldenModes: 150,
  rollforwards: 80,
  tripleRollforwards: 5,
  swarmsWon: 40,
  swarmsCleared: 12,
  festas: 40,
  bolsaProfitSeconds: 7_200,
  designFreeLevels: 900,
  cappedGraduations: 6,
});

writeFileSync('dev-save.txt', exportSave(state));
console.log('dev-save.txt escrito. No jogo: Config → Importar save → cole o conteúdo do arquivo.');
