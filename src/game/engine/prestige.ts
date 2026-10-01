import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, PrestigeNodeDef, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, ZERO, parseDecimal } from './decimal';
import type { GameState } from './state';
import { computeStats, hasFeature } from './stats';
import type { Stats } from './stats';

/** diplomas = floor((runCoins / base) ^ exponent x diplomaGain) */
export function diplomasFor(runCoins: Decimal, content: GameContent, stats: Stats): number {
  const { base, exponent } = content.balance.graduation;
  const reference = parseDecimal(base);
  if (reference.lte(0) || runCoins.lte(0)) return 0;
  const value = runCoins.div(reference).pow(exponent).mul(stats.diplomaGain).floor().toNumber();
  if (Number.isNaN(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value));
}

/** Run coins needed to graduate with `diplomas` in total (the inverse of diplomasFor). */
export function runCoinsFor(diplomas: number, content: GameContent, stats: Stats): Decimal {
  const { base, exponent } = content.balance.graduation;
  if (diplomas <= 0) return ZERO;
  const gain = Math.max(stats.diplomaGain, 1e-9);
  return parseDecimal(base).mul(Decimal.pow(diplomas / gain, 1 / exponent));
}

export function canGraduate(state: GameState, content: GameContent, stats: Stats): boolean {
  return hasFeature(state, content, 'graduation') && diplomasFor(state.runCoins, content, stats) >= 1;
}

/** Professors that survive a graduation because of prestige nodes the player owns. */
export function keptProfessors(state: GameState, content: GameContent): Set<ProfessorId> {
  const kept = new Set<ProfessorId>();
  const index = getIndex(content);
  for (const id in state.prestige) {
    const node = index.prestigeNodes.get(id);
    if (node && (state.prestige[id] ?? 0) > 0) node.keepsProfessors?.forEach((p) => kept.add(p));
  }
  return kept;
}

/**
 * Graduation: pays diplomas and resets the run. Resets coins, runCoins, levels, research, hires
 * (except the first professor and those kept by prestige nodes), buffs, invasion and streak, sprint,
 * combo and cooldowns. Keeps diplomas, the tree, achievements, cosmetics, counters and settings.
 */
export function graduate(state: GameState, content: GameContent, emit: Emit): boolean {
  const stats = computeStats(state, content);
  if (!canGraduate(state, content, stats)) return false;
  const diplomas = diplomasFor(state.runCoins, content, stats);
  const index = getIndex(content);
  const kept = keptProfessors(state, content);

  state.diplomas += diplomas;
  state.diplomasEarned += diplomas;
  state.counters.graduations += 1;

  state.coins = ZERO;
  state.runCoins = ZERO;
  state.levels = {};
  state.research = {};
  for (const id of PROFESSOR_IDS) state.hired[id] = id === index.firstProfessor || kept.has(id);
  if (!state.hired[state.activeProfessor]) state.activeProfessor = index.firstProfessor;

  state.buffs = [];
  state.abilityReadyAt = {};
  state.invasion = null;
  state.nextInvasionAt = 0;
  state.eventStreak = 0;
  state.sprint = { offers: [], active: null, nextOffersAt: 0 };
  state.combo = { steps: 0, lastClickAt: 0 };
  state.autoClickCarry = 0;
  if (!hasFeature(state, content, 'bulkBuy')) state.buyAmount = 1;

  emit({ type: 'graduate', diplomas });
  return true;
}

/** Diploma cost of the next level of a node: cost x costGrowth ^ level, rounded up. */
export function prestigeNodeCost(def: PrestigeNodeDef, level: number): number {
  return Math.ceil(def.cost * def.costGrowth ** level - 1e-9);
}

export function prestigeNodeAvailable(state: GameState, def: PrestigeNodeDef): boolean {
  return def.requires.every((id) => (state.prestige[id] ?? 0) > 0);
}

export function buyPrestigeNode(state: GameState, content: GameContent, id: string, emit: Emit): boolean {
  const def = getIndex(content).prestigeNodes.get(id);
  if (!def) return false;
  const level = state.prestige[id] ?? 0;
  if (level >= def.maxLevel || !prestigeNodeAvailable(state, def)) return false;
  const cost = prestigeNodeCost(def, level);
  if (state.diplomas < cost) return false;

  state.diplomas -= cost;
  state.prestige[id] = level + 1;
  emit({ type: 'purchase', kind: 'prestigeNode', id, levels: 1 });
  return true;
}
