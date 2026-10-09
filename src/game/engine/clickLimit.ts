import type { GameContent } from '../content/types';
import type { GameState } from './state';

/** Times of the clicks accepted in the last window, per working state. Not saved: a reload starts empty. */
const recent = new WeakMap<GameState, number[]>();

/**
 * Rolling-window limit on manual clicks (balance.clickLimit). Returns false when the click must be dropped:
 * the caller then does nothing at all (no coins, combo, counters or Maestria progress).
 */
export function acceptClick(state: GameState, content: GameContent, now: number): boolean {
  const limit = content.balance.clickLimit;
  if (!limit) return true;
  const max = Math.max(1, Math.floor((limit.perSecond * limit.windowMs) / 1000));
  let times = recent.get(state);
  if (!times) {
    times = [];
    recent.set(state, times);
  }
  // Drop what left the window (and anything from the future, if the clock went backwards).
  const from = now - limit.windowMs;
  let keep = 0;
  for (const at of times) if (at > from && at <= now) times[keep++] = at;
  times.length = keep;
  if (times.length >= max) return false;
  times.push(now);
  return true;
}
