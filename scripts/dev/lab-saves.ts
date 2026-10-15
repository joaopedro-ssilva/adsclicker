// Builds saves in each state of the Laboratório de Pesquisa, to look at its screens (see scripts/qa/lab.mjs).
// Usage: npx tsx scripts/dev/lab-saves.ts <out-dir>   →   writes <out-dir>/lab-<name>.json (raw JSON, as localStorage keeps it)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStream } from '@/hackathon/engine/rng';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Decimal, createInitialState } from '@/game/engine';
import { advanceLab, chooseLabReward, labTotals, rollItem, startLabRun } from '@/game/engine/lab';
import { spawnPhase } from '@/game/engine/lab/phase';
import type { LabItem } from '@/game/engine/lab';
import { serializeState } from '@/game/engine/save';
import type { GameState } from '@/game/engine/state';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const now = Date.now();
const emit = () => undefined;

function base(): GameState {
  const state = createInitialState(content, now);
  for (const id of PROFESSOR_IDS) state.hired[id] = true;
  for (const discipline of content.disciplines) state.levels[discipline.id] = 3;
  state.coins = new Decimal('4e27');
  state.runCoins = new Decimal('4e27');
  state.lifetimeCoins = new Decimal('4e28');
  state.diplomas = 400;
  state.diplomasEarned = 400;
  return state;
}

function ready(): GameState {
  const state = base();
  state.lab.unlocked = true;
  state.lab.commits = 140;
  state.lab.bestPhase = 9;
  state.lab.counters = { ...state.lab.counters, runs: 3, broken: 3, phasesCleared: 21, bossesBeaten: 3, itemsFound: 11, itemsRecycled: 4, clicks: 812, commitsEarned: 300 };
  state.lab.tree = { 'algoritmos-eficientes': 2, 'monitor-reforcado': 1 };
  return state;
}

function give(state: GameState, baseId: string, rarity: LabItem['rarity'], level: number, seed: number): void {
  const def = content.lab.bases.find((entry) => entry.id === baseId)!;
  const item = rollItem(content, def, rarity, level, createStream(seed, 7));
  item.uid = state.lab.turma.nextUid;
  state.lab.turma.nextUid += 1;
  state.lab.turma.equipped[def.slot] = item;
}

/** A run in `phase`, with a few items, `fraction` of the integrity left, after `seconds` of fighting. */
function fighting(phase: number, fraction: number, seconds: number): GameState {
  const state = ready();
  startLabRun(state, content, 12345, emit);
  give(state, 'mochila-de-notebook', 'raro', 4, 1);
  give(state, 'cadeira-ergonomica', 'epico', 6, 2);
  give(state, 'trevo-de-quatro-folhas', 'lendario', 3, 3);
  const run = state.lab.turma.run!;
  run.phase = phase;
  run.cleared = phase - 1;
  run.mobs = [];
  spawnPhase(state, content, labTotals(state, content));
  run.integrity = run.maxIntegrity * fraction;
  state.lab.open = true;
  advanceLab(state, content, seconds, emit);
  return state;
}

function save(name: string, state: GameState): void {
  state.lastTickAt = now;
  writeFileSync(join(out, `lab-${name}.json`), serializeState(state));
  console.log(`lab-${name}.json`);
}

// 1. The 9th slot, locked
save('locked', base());

// 2. Unlocked but an aula is still at level 0
const blocked = ready();
blocked.levels[content.disciplines[0]!.id] = 0;
blocked.levels[content.disciplines[5]!.id] = 0;
save('blocked', blocked);

// 3. Ready to start
save('ready', ready());

// 4. Mid fight, a few cracks
save('fight', fighting(7, 0.62, 0.8));

// 5. Boss
save('boss', fighting(10, 0.4, 1.4));

// 6. Rewards on screen
const reward = fighting(6, 0.8, 0);
for (let i = 0; i < 400 && reward.lab.turma.run!.status === 'fighting'; i += 1) advanceLab(reward, content, 1, emit);
save('reward', reward);

// 7. Equip or recycle: pick an item offer for a slot that is already taken
for (let phase = 3; phase < 40; phase += 1) {
  const state = fighting(phase, 0.9, 0);
  const run = state.lab.turma.run!;
  for (let i = 0; i < 400 && run.status === 'fighting'; i += 1) advanceLab(state, content, 1, emit);
  const index = run.offers.findIndex((offer) => offer.kind === 'item');
  if (run.status !== 'reward' || index < 0) continue;
  chooseLabReward(state, content, index, emit);
  if ((run.status as string) === 'equip') {
    save('equip', state);
    break;
  }
}

// 8. Broken monitor
const broken = fighting(8, 0.02, 0);
broken.lab.turma.run!.integrity = 0.2;
for (let i = 0; i < 50 && broken.lab.turma.run!.status === 'fighting'; i += 1) advanceLab(broken, content, 1, emit);
save('broken', broken);

// 9. The tree, with a purse
const tree = ready();
tree.lab.commits = 90;
tree.lab.tree = { 'algoritmos-eficientes': 3, 'estudo-de-chefao': 1, 'monitor-reforcado': 2, 'revisao-de-pr': 1, 'codigo-limpo': 6 };
save('tree', tree);
