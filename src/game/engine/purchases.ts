import type { GameContent, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, parseDecimal } from './decimal';
import { levelOf, spend } from './economy';
import { bulkCost, maxAffordable, milestonesCrossed } from './formulas';
import { afterAction } from './lifecycle';
import { hireLock, levelledLock, researchLock } from './requirements';
import { recordSprintEvent } from './sprints';
import type { BuyAmount, GameState } from './state';
import { computeStats, hasFeature } from './stats';
import type { Stats } from './stats';

/** x10 and max need the `bulkBuy` feature; without it every purchase is x1. */
export function effectiveBuyAmount(state: GameState, content: GameContent): BuyAmount {
  return state.buyAmount !== 1 && !hasFeature(state, content, 'bulkBuy') ? 1 : state.buyAmount;
}

export function setBuyAmount(state: GameState, content: GameContent, amount: BuyAmount): boolean {
  if (amount !== 1 && !hasFeature(state, content, 'bulkBuy')) return false;
  state.buyAmount = amount;
  return true;
}

export interface PurchaseQuote {
  /** Levels the purchase would give. At least 1, even when unaffordable. */
  count: number;
  cost: Decimal;
}

/** How many levels of a discipline or click upgrade `amount` buys right now, and what they cost. */
export function quoteLevels(
  state: GameState,
  content: GameContent,
  stats: Stats,
  id: string,
  amount: BuyAmount,
): PurchaseQuote {
  const baseCost = getIndex(content).baseCost.get(id) ?? parseDecimal('0');
  const level = levelOf(state, id);
  const count = amount === 'max' ? Math.max(1, maxAffordable(state.coins, baseCost, level, stats)) : amount;
  return { count, cost: bulkCost(baseCost, level, count, stats) };
}

/** Buys disciplines and click upgrades alike, respecting the buy amount and the unlock rules. */
export function buyLevelled(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const entry = getIndex(content).levelled.get(id);
  if (!entry || levelledLock(state, content, entry) !== null) return false;

  const stats = computeStats(state, content);
  const { count, cost } = quoteLevels(state, content, stats, id, effectiveBuyAmount(state, content));
  if (state.coins.lt(cost)) return false;

  const from = levelOf(state, id);
  spend(state, cost);
  state.levels[id] = from + count;
  state.counters.levelsBought += count;
  recordSprintEvent(state, content, { kind: 'buyLevels', amount: count });

  emit({ type: 'purchase', kind: entry.kind, id, levels: count });
  for (const level of milestonesCrossed(from, from + count, content.balance)) {
    emit({ type: 'milestone', id, level });
  }
  afterAction(state, content, now, emit);
  return true;
}

export function buyResearch(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const def = getIndex(content).research.get(id);
  if (!def || state.research[id] || researchLock(state, content, def) !== null) return false;
  const cost = parseDecimal(def.cost);
  if (state.coins.lt(cost)) return false;

  spend(state, cost);
  state.research[id] = true;
  state.counters.researchBought += 1;
  emit({ type: 'purchase', kind: 'research', id, levels: 1 });
  afterAction(state, content, now, emit);
  return true;
}

/** Hires a professor: the previous one in order must be hired, requirements met, cost paid. */
export function hireProfessor(state: GameState, content: GameContent, id: ProfessorId, now: number, emit: Emit): boolean {
  const def = content.professors[id];
  if (state.hired[id] || hireLock(state, content, def) !== null) return false;
  const cost = parseDecimal(def.hireCost);
  if (state.coins.lt(cost)) return false;

  spend(state, cost);
  state.hired[id] = true;
  emit({ type: 'hire', professor: id });
  afterAction(state, content, now, emit);
  return true;
}

/** Puts a hired professor on stage. Changing counts as a swap. */
export function setActiveProfessor(state: GameState, content: GameContent, id: ProfessorId, now: number, emit: Emit): boolean {
  if (!state.hired[id] || state.activeProfessor === id) return false;
  state.activeProfessor = id;
  state.counters.professorSwaps += 1;
  afterAction(state, content, now, emit);
  return true;
}

export function equipSkin(state: GameState, content: GameContent, id: string): boolean {
  const skin = getIndex(content).skins.get(id);
  if (!skin || !state.skins[id]) return false;
  state.equippedSkin[skin.professor] = id;
  return true;
}

export function equipScenery(state: GameState, content: GameContent, id: string): boolean {
  if (!getIndex(content).sceneries.has(id) || !state.sceneries[id]) return false;
  state.equippedScenery = id;
  return true;
}

export function equipTheme(state: GameState, content: GameContent, id: string): boolean {
  if (!getIndex(content).themes.has(id) || !state.themes[id]) return false;
  state.equippedTheme = id;
  return true;
}
