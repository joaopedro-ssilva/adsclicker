import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { decayCombo } from './combo';
import { clickValueWith, gain } from './economy';
import { afterAction } from './lifecycle';
import { recordSprintEvent } from './sprints';
import type { GameState } from './state';
import { computeStats, hasFeature } from './stats';

export interface ClickPosition {
  x?: number;
  y?: number;
}

/**
 * A click on the professor on stage. With the `combo` feature, a click inside the combo window
 * (or while the combo is still decaying) adds a step, and rolls a crit with `rng`.
 */
export function click(
  state: GameState,
  content: GameContent,
  now: number,
  rng: () => number,
  emit: Emit,
  position: ClickPosition = {},
): void {
  const stats = computeStats(state, content);
  const config = content.balance.combo;
  let crit = false;

  if (hasFeature(state, content, 'combo')) {
    decayCombo(state, config, state.lastTickAt, now);
    const { steps, lastClickAt } = state.combo;
    const continuing = steps > 0 || (lastClickAt > 0 && now - lastClickAt <= config.windowMs);
    if (continuing) state.combo.steps = Math.min(stats.comboMax, steps + 1);
    crit = rng() < stats.critChance;
  }
  state.combo.lastClickAt = now;

  const steps = state.combo.steps;
  const value = clickValueWith(state, content, stats, { comboSteps: steps, crit });
  gain(state, value);

  const counters = state.counters;
  counters.clicks += 1;
  if (crit) counters.crits += 1;
  counters.maxCombo = Math.max(counters.maxCombo, Math.floor(steps));

  recordSprintEvent(state, content, { kind: 'clicks', amount: 1 });
  if (crit) recordSprintEvent(state, content, { kind: 'crits', amount: 1 });
  recordSprintEvent(state, content, { kind: 'reachCombo', amount: Math.floor(steps) });

  emit({ type: 'click', value, crit, comboSteps: steps, auto: false, x: position.x, y: position.y });
  afterAction(state, content, now, emit, { throttle: true });
}
