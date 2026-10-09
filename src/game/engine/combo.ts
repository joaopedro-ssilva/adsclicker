import type { BalanceConfig } from '../content/types';
import type { GameState } from './state';

/**
 * Lets the combo decay over the interval [from, to] (epoch ms). Nothing decays during the
 * grace window after the last click, nor while the golden mode of Joinha de Ouro lasts; after that, `decayPerSecond` x `rate` (the comboDecay stat) steps are lost per second.
 */
export function decayCombo(
  state: GameState,
  config: BalanceConfig['combo'],
  from: number,
  to: number,
  rate = 1,
): void {
  if (state.combo.steps <= 0) return;
  const start = Math.max(from, state.combo.lastClickAt + config.windowMs, state.maestria.joinha.activeUntil);
  if (to <= start) return;
  state.combo.steps = Math.max(0, state.combo.steps - config.decayPerSecond * rate * ((to - start) / 1000));
}
