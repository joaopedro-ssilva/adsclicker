import type { BalanceConfig } from '../content/types';
import type { GameState } from './state';

/**
 * Lets the combo decay over the interval [from, to] (epoch ms). Nothing decays during the
 * grace window after the last click; after it, `decayPerSecond` steps are lost per second.
 */
export function decayCombo(state: GameState, config: BalanceConfig['combo'], from: number, to: number): void {
  if (state.combo.steps <= 0) return;
  const start = Math.max(from, state.combo.lastClickAt + config.windowMs);
  if (to <= start) return;
  state.combo.steps = Math.max(0, state.combo.steps - config.decayPerSecond * ((to - start) / 1000));
}
