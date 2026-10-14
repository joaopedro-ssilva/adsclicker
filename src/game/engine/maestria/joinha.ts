import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import type { Stats } from '../stats';
import { atLevel } from './production';
import { maestriaLevel } from './slots';

/** Seconds the golden mode lasts at the current level; 0 when Joinha de Ouro is not unlocked. */
export function joinhaSeconds(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'edecio');
  return level > 0 ? atLevel(content.maestrias.joinha.seconds, level) : 0;
}

/** What a hand click is worth while the mode lasts (1 when the Maestria is not unlocked). */
export function joinhaMultiplier(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'edecio');
  return level > 0 ? atLevel(content.maestrias.joinha.multiplier, level) : 1;
}

/** Seconds of recharge after the mode ends; 0 when Joinha de Ouro is not unlocked. */
export function joinhaRechargeSeconds(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'edecio');
  return level > 0 ? atLevel(content.maestrias.joinha.rechargeSeconds, level) : 0;
}

/** True while the golden mode lasts. */
export function goldenActive(state: GameState, now: number): boolean {
  return maestriaLevel(state, 'edecio') > 0 && now < state.maestria.joinha.activeUntil;
}

/** True when a full combo would start the mode now: unlocked, not running and the recharge is over. */
export function goldenReady(state: GameState, now: number): boolean {
  const { activeUntil, readyAt } = state.maestria.joinha;
  return maestriaLevel(state, 'edecio') > 0 && now >= activeUntil && now >= readyAt;
}

/** The factor the mode puts on the final value of a hand click (1 when it is off). */
export function goldenFactor(state: GameState, content: GameContent, now: number): number {
  return goldenActive(state, now) ? joinhaMultiplier(state, content) : 1;
}

/**
 * Called by every manual click right after the combo took its step: a combo at its maximum starts the mode when
 * the recharge is over. The click that fills the combo is already golden. The recharge counts from the end of the mode.
 */
export function maybeStartGolden(state: GameState, content: GameContent, stats: Stats, now: number, emit: Emit): boolean {
  if (stats.comboMax <= 0 || state.combo.steps < stats.comboMax || !goldenReady(state, now)) return false;
  const endsAt = now + joinhaSeconds(state, content) * 1000;
  state.maestria.joinha = { activeUntil: endsAt, readyAt: endsAt + joinhaRechargeSeconds(state, content) * 1000 };
  state.counters.goldenModes += 1;
  emit({ type: 'joinhaStart', endsAt });
  return true;
}
