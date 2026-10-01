// Builds a "dev account" save with everything unlocked, to look at late-game screens.
// Usage: npm run dev:save   →   writes dev-save.txt; paste its contents in Config → Importar save.
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
for (const discipline of content.disciplines) state.levels[discipline.id] = 200;
for (const upgrade of content.clickUpgrades) state.levels[upgrade.id] = 200;
for (const research of content.research) state.research[research.id] = true;
for (const node of content.prestigeNodes) state.prestige[node.id] = node.maxLevel;
state.buyAmount = 'max';

for (const achievement of content.achievements) {
  state.achievements[achievement.id] = now;
  if (achievement.condition.kind === 'secret') state.secrets[achievement.condition.trigger] = true;
}
for (const skin of content.skins) state.skins[skin.id] = true;
for (const scenery of content.sceneries) state.sceneries[scenery.id] = true;
for (const theme of content.themes) state.themes[theme.id] = true;

Object.assign(state.counters, {
  clicks: 250_000,
  crits: 9_000,
  maxCombo: 60,
  eventsDefended: 400,
  bestEventStreak: 40,
  abilitiesUsed: 120,
  sprintsCompleted: 150,
  levelsBought: 6_000,
  researchBought: content.research.length,
  graduations: 12,
  playSeconds: 40 * 3600,
});

writeFileSync('dev-save.txt', exportSave(state));
console.log('dev-save.txt escrito. No jogo: Config → Importar save → cole o conteúdo do arquivo.');
