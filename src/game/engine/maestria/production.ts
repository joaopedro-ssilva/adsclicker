import type { GameContent } from '../../content/types';
import type { Decimal } from '../decimal';
import { coinsPerSecondWith } from '../economy';
import type { GameState } from '../state';
import { computeStats } from '../stats';

/**
 * Coins/second of the class with no temporary buff running. Every Maestria reward is measured in
 * seconds of this, so an ability that happens to be active does not inflate a golden click, a jump
 * or a swarm, and the server can bound them by the state's own production.
 */
export function steadyCoinsPerSecond(state: GameState, content: GameContent): Decimal {
  if (state.buffs.length === 0) return coinsPerSecondWith(state, content, computeStats(state, content));
  const buffs = state.buffs;
  state.buffs = [];
  try {
    return coinsPerSecondWith(state, content, computeStats(state, content));
  } finally {
    state.buffs = buffs;
  }
}

export { atLevel } from './levelTable';
