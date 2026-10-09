import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { decayCombo } from './combo';
import { Decimal } from './decimal';
import { acceptClick } from './clickLimit';
import { clickValueWith, gain } from './economy';
import { afterAction } from './lifecycle';
import { goldenCanCrit, goldenReady, goldenValue, recordJoinhaClick } from './maestria/joinha';
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

  // Joinha de Ouro: after enough manual clicks the next one is golden. It crits only from the level that allows it.
  const golden = goldenReady(state, content);
  if (golden && !goldenCanCrit(state, content)) crit = false;

  const steps = state.combo.steps;
  let value = clickValueWith(state, content, stats, { comboSteps: steps, crit });
  if (golden) value = Decimal.max(value, goldenValue(state, content, stats, crit));
  gain(state, value);
  recordJoinhaClick(state, content, golden);
  recordRollforwardClick(state, content);
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
