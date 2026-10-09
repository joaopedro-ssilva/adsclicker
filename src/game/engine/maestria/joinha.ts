import type { GameContent } from '../../content/types';
import type { Decimal } from '../decimal';
import type { GameState } from '../state';
import type { Stats } from '../stats';
import { atLevel, steadyCoinsPerSecond } from './production';
import { maestriaLevel } from './slots';

/** Manual clicks before the golden one at the current level; 0 when Joinha de Ouro is not unlocked. */
export function joinhaClicksNeeded(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'edecio');
  return level > 0 ? atLevel(content.maestrias.joinha.clicksNeeded, level) : 0;
}

/** True when the next manual click is the golden one. */
export function goldenReady(state: GameState, content: GameContent): boolean {
  const needed = joinhaClicksNeeded(state, content);
  return needed > 0 && state.maestria.joinha.clicks >= needed;
}

/** The golden click can crit from this level on. */
export function goldenCanCrit(state: GameState, content: GameContent): boolean {
  return maestriaLevel(state, 'edecio') >= content.maestrias.joinha.critFromLevel;
}

/** Seconds of the class's coins/second the golden click is worth at the current level. */
export function goldenSeconds(state: GameState, content: GameContent): number {
  return atLevel(content.maestrias.joinha.seconds, maestriaLevel(state, 'edecio'));
}

/** What a golden click pays: seconds of steady production, times the crit multiplier when it crits. */
export function goldenValue(state: GameState, content: GameContent, stats: Stats, crit: boolean): Decimal {
  const value = steadyCoinsPerSecond(state, content).mul(goldenSeconds(state, content));
  return crit ? value.mul(stats.critMult) : value;
}

/** Called by every manual click after it was paid: counts towards the next golden click. */
export function recordJoinhaClick(state: GameState, content: GameContent, golden: boolean): void {
  const needed = joinhaClicksNeeded(state, content);
  if (needed <= 0) return;
  state.maestria.joinha.clicks = golden ? 0 : Math.min(needed, state.maestria.joinha.clicks + 1);
}
