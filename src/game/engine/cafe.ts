import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { Decimal } from './decimal';
import { coinsPerSecondWith, spend } from './economy';
import { afterAction } from './lifecycle';
import type { GameState } from './state';
import { computeStats } from './stats';

/**
 * Café is the energy of the Hackathon mode, bought here with ADScoins. The price is a slice of
 * the current production, so it keeps its weight no matter how far the coins have inflated.
 * The engine only records the purchase (counters.cafesBought); the server credits the Café
 * to the Hackathon profile when it sees the counter grow at the next sync.
 */
export const CAFE_COST_SECONDS = 600;
/** Floor of the price, for a classroom that produces almost nothing yet. */
const CAFE_MIN_COST = 1_000;

export function cafeCost(state: GameState, content: GameContent): Decimal {
  const perSecond = coinsPerSecondWith(state, content, computeStats(state, content));
  return Decimal.max(CAFE_MIN_COST, perSecond.mul(CAFE_COST_SECONDS)).ceil();
}

export function buyCafe(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const cost = cafeCost(state, content);
  if (state.coins.lt(cost)) return false;
  spend(state, cost);
  state.counters.cafesBought += 1;
  afterAction(state, content, now, emit);
  return true;
}
