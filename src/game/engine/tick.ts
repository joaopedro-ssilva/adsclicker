import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { checkAchievementsThrottled } from './achievements';
import { expireBuffs } from './buffs';
import { decayCombo } from './combo';
import { clickValueWith, coinsPerSecondWith, gain } from './economy';
import { updateInvasions } from './invasions';
import { offerSprints, settleSprint } from './sprints';
import type { GameState } from './state';
import { computeStats, hasFeature, invalidateStats } from './stats';

/** Instants inside (from, to) where the rules change: a buff ends or the sprint deadline hits. */
function boundaries(state: GameState, from: number, to: number): number[] {
  const cuts = new Set<number>();
  for (const buff of state.buffs) if (buff.endsAt > from && buff.endsAt < to) cuts.add(buff.endsAt);
  const sprint = state.sprint.active;
  if (sprint && sprint.endsAt > from && sprint.endsAt < to) cuts.add(sprint.endsAt);
  return [...cuts].sort((a, b) => a - b);
}

/** Advances the simulation across [from, to], a span in which stats are constant. */
function runSegment(state: GameState, content: GameContent, from: number, to: number, emit: Emit): void {
  const seconds = (to - from) / 1000;
  const stats = computeStats(state, content);

  if (hasFeature(state, content, 'combo')) decayCombo(state, content.balance.combo, from, to);

  gain(state, coinsPerSecondWith(state, content, stats).mul(seconds));

  if (stats.autoClicks > 0) {
    const owed = state.autoClickCarry + stats.autoClicks * seconds;
    const clicks = Math.floor(owed);
    state.autoClickCarry = owed - clicks;
    if (clicks > 0) {
      const value = clickValueWith(state, content, stats).mul(clicks);
      gain(state, value);
      emit({ type: 'click', value, crit: false, comboSteps: 0, auto: true });
    }
  }

  state.counters.playSeconds += seconds;
  expireBuffs(state, to, emit);
  invalidateStats(state);
  settleSprint(state, content, to, emit);
}

/**
 * Advances the game to `now` by real elapsed time, in one step however long the gap is (a tab
 * that slept for an hour included). The span is cut where a buff ends or the sprint deadline
 * falls, so every piece is computed with the stats that were really in force.
 */
export function advance(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  const start = state.lastTickAt;
  if (now < start) {
    state.lastTickAt = now; // the clock went backwards: resynchronise, produce nothing
    return;
  }

  const points = [start, ...boundaries(state, start, now), now];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (from !== undefined && to !== undefined && to > from) runSegment(state, content, from, to, emit);
  }

  updateInvasions(state, content, now, rng, emit);
  offerSprints(state, content, now, rng, emit);
  state.lastTickAt = now;
  invalidateStats(state);
  checkAchievementsThrottled(state, content, now, emit);
  invalidateStats(state);
}
