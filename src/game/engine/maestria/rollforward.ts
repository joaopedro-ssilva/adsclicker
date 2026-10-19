import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { shiftMaestriaTimers } from './timers';
import { atLevel, steadyCoinsPerSecond } from './production';
import { activeMaestriaLevel } from './slots';

/** Stored charges that make a spend a "triple" one (an achievement counts it). */
const TRIPLE_CHARGES = 3;

/** Charges the Rollforward can hold at the current level; 0 when it is not unlocked. */
export function rollforwardMaxCharges(state: GameState, content: GameContent): number {
  const level = activeMaestriaLevel(state, 'gladimir');
  return level > 0 ? atLevel(content.maestrias.rollforward.maxCharges, level) : 0;
}

/** How far one charge jumps the game forward, in ms. */
export function rollforwardJumpMs(state: GameState, content: GameContent): number {
  return atLevel(content.maestrias.rollforward.jumpSeconds, activeMaestriaLevel(state, 'gladimir')) * 1000;
}

/** Called by every manual click after it was paid: fills the next charge. */
export function recordRollforwardClick(state: GameState, content: GameContent): void {
  const max = rollforwardMaxCharges(state, content);
  const roll = state.maestria.rollforward;
  if (max <= 0 || roll.charges >= max) return;
  roll.clicks += 1;
  if (roll.clicks >= content.maestrias.rollforward.clicksToFill) {
    roll.clicks = 0;
    roll.charges += 1;
  }
}

/**
 * Spends a charge: the coins of the jump (steady production x the period) arrive at once and every
 * recharge timer moves forward by the same time. Countdowns that are running (a sprint, the invasion on
 * stage, a buff) are not touched, and the coins do not count as progress of an earn-seconds sprint.
 */
export function fireRollforward(state: GameState, content: GameContent, emit: Emit): boolean {
  const roll = state.maestria.rollforward;
  if (activeMaestriaLevel(state, 'gladimir') <= 0 || roll.charges < 1) return false;

  const ms = rollforwardJumpMs(state, content);
  const coins = steadyCoinsPerSecond(state, content).mul(ms / 1000);
  state.counters.rollforwards += 1;
  if (roll.charges >= TRIPLE_CHARGES) state.counters.tripleRollforwards += 1;
  roll.charges -= 1;
  if (coins.gt(0)) {
    state.coins = state.coins.add(coins);
    state.runCoins = state.runCoins.add(coins);
    state.lifetimeCoins = state.lifetimeCoins.add(coins);
    state.run.extraCoins = state.run.extraCoins.add(coins);
  }
  shiftMaestriaTimers(state, ms);
  emit({ type: 'rollforward', ms, coins });
  return true;
}
