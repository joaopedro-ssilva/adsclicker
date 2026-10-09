import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, PrestigeNodeDef, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, ZERO, parseDecimal, ratio } from './decimal';
import { createRunStats } from './init';
import { resetMaestriasForGraduation } from './maestria';
import { recordGraduationDay } from './session';
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

/** Most diplomas the next graduation can pay: base x growth ^ graduations done. Null when the content sets no cap. */
export function diplomaCap(state: GameState, content: GameContent): number | null {
  const cap = content.balance.graduation.cap;
  if (!cap) return null;
  const value = cap.base * cap.growth ** state.counters.graduations;
  return Number.isFinite(value) ? Math.floor(value) : Number.MAX_SAFE_INTEGER;
}

/** Diplomas the current run pays if the player graduates now: diplomasFor, held at the cap. */
export function diplomasForRun(state: GameState, content: GameContent, stats: Stats): number {
  const worth = diplomasFor(state.runCoins, content, stats);
  const cap = diplomaCap(state, content);
  return cap === null ? worth : Math.min(worth, cap);
}

/** Run coins needed to graduate with `diplomas` in total (the inverse of diplomasFor). */
export function runCoinsFor(diplomas: number, content: GameContent, stats: Stats): Decimal {
  const { base, exponent } = content.balance.graduation;
  if (diplomas <= 0) return ZERO;
  const gain = Math.max(stats.diplomaGain, 1e-9);
  return parseDecimal(base).mul(Decimal.pow(diplomas / gain, 1 / exponent));
}

export function canGraduate(state: GameState, content: GameContent, stats: Stats): boolean {
  return hasFeature(state, content, 'graduation') && diplomasForRun(state, content, stats) >= 1;
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
 *
 * `honour` is the hired professor the player picked to honour for the next run (none by default); it
 * replaces the previous pick. `now` only dates the graduation for the calendar achievements.
 */
export function graduate(
  state: GameState,
  content: GameContent,
  emit: Emit,
  now: number = state.lastTickAt,
  honour: ProfessorId | null = null,
): boolean {
  const stats = computeStats(state, content);
  if (!canGraduate(state, content, stats)) return false;
  const diplomas = diplomasForRun(state, content, stats);
  const index = getIndex(content);
  const kept = keptProfessors(state, content);

  state.lastRun = {
    seconds: state.run.seconds,
    clicks: state.run.clicks,
    investedProfessors: PROFESSOR_IDS.filter((id) => index.disciplinesOf[id].some((def) => (state.levels[def.id] ?? 0) > 0)).length,
    clickShare: state.runCoins.gt(0) ? Math.min(1, ratio(state.run.clickCoins, state.runCoins)) : 0,
    sprintsCompleted: state.run.sprintsCompleted,
    sprintsFailed: state.run.sprintsFailed,
    eventsDefended: state.run.eventsDefended,
    eventsMissed: state.run.eventsMissed,
  };
  state.run = createRunStats();
  state.honoured = honour !== null && state.hired[honour] ? honour : null;
  if (state.honoured) state.honouredBefore[state.honoured] = true;
  recordGraduationDay(state, now);

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
  resetMaestriasForGraduation(state);
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
