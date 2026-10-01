import type { GameContent } from '../content/types';
import type { Emit, OfflineReport } from '../store/types';
import { ZERO } from './decimal';
import { coinsPerSecondWith, gain } from './economy';
import { afterAction } from './lifecycle';
import type { GameState } from './state';
import { computeStats, hasFeature, invalidateStats } from './stats';

const HOUR_MS = 3_600_000;

/**
 * Pays earnings for time spent away, measured from the last tick: `coinsPerSecond x time x
 * offlineRate`, with the time capped at `offlineHours`. Needs the `offline` feature; without it
 * nothing is paid.
 *
 * Gaps shorter than `minAwayMs` are left alone (returns null, lastTickAt untouched) so the normal
 * tick covers them at full rate. Longer gaps are consumed here: buffs end, the invasion is cleared
 * without penalty, the combo drops and a running sprint is paused for the time away.
 */
export function applyOffline(state: GameState, content: GameContent, now: number, emit: Emit): OfflineReport | null {
  const awayMs = Math.max(0, now - state.lastTickAt);
  if (awayMs < content.balance.offline.minAwayMs) return null;

  state.lastTickAt = now;
  state.buffs = [];
  state.invasion = null;
  state.nextInvasionAt = 0;
  state.combo = { steps: 0, lastClickAt: 0 };
  state.autoClickCarry = 0;
  const sprint = state.sprint.active;
  if (sprint) {
    sprint.startedAt += awayMs;
    sprint.endsAt += awayMs;
  }
  invalidateStats(state);

  if (!hasFeature(state, content, 'offline')) return null;

  const stats = computeStats(state, content);
  const countedMs = Math.min(awayMs, stats.offlineHours * HOUR_MS);
  const coins = coinsPerSecondWith(state, content, stats).mul((countedMs / 1000) * stats.offlineRate);
  if (coins.lte(ZERO)) return null;

  gain(state, coins);
  state.counters.offlineCollections += 1;
  emit({ type: 'offline', coins, awayMs });
  afterAction(state, content, now, emit);
  return { coins, awayMs, countedMs };
}
