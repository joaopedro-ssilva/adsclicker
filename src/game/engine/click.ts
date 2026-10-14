import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { decayCombo } from './combo';
import { acceptClick } from './clickLimit';
import { clickValueWith, gain } from './economy';
import { afterAction } from './lifecycle';
import { goldenFactor, maybeStartGolden } from './maestria/joinha';
import { recordHoras } from './maestria/horas';
import { recordRollforwardClick } from './maestria/rollforward';
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
  if (!acceptClick(state, content, now)) return;
  const stats = computeStats(state, content);
  const config = content.balance.combo;
  let crit = false;

  if (hasFeature(state, content, 'combo')) {
    decayCombo(state, config, state.lastTickAt, now, stats.comboDecay);
    const { steps, lastClickAt } = state.combo;
    const continuing = steps > 0 || (lastClickAt > 0 && now - lastClickAt <= config.windowMs);
    if (continuing) state.combo.steps = Math.min(stats.comboMax, steps + 1);
    crit = rng() < stats.critChance;
  }
  state.combo.lastClickAt = now;

  // Joinha de Ouro: a full combo starts the golden mode (this click already counts), which multiplies the final value of a hand click.
  maybeStartGolden(state, content, stats, now, emit);
  const factor = goldenFactor(state, content, now);
  const golden = factor > 1;

  const steps = state.combo.steps;
  let value = clickValueWith(state, content, stats, { comboSteps: steps, crit });
  if (golden) value = value.mul(factor);
  gain(state, value);
  recordRollforwardClick(state, content);
  recordHoras(state, content, 'clicks');
  state.run.clicks += 1;
  state.run.clickCoins = state.run.clickCoins.add(value);

  const counters = state.counters;
  counters.clicks += 1;
  if (crit) counters.crits += 1;
  counters.maxCombo = Math.max(counters.maxCombo, Math.floor(steps));

  recordSprintEvent(state, content, { kind: 'clicks', amount: 1 });
  if (crit) recordSprintEvent(state, content, { kind: 'crits', amount: 1 });
  recordSprintEvent(state, content, { kind: 'reachCombo', amount: Math.floor(steps) });

  emit({ type: 'click', value, crit, comboSteps: steps, auto: false, x: position.x, y: position.y, golden });
  afterAction(state, content, now, emit, { throttle: true });
}
