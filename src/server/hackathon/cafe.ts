/**
 * Café regenerates lazily: the database keeps the count and the instant it was last computed
 * from, and every read works out the rest. Nothing runs in the background.
 */
export interface CafeConfig {
  max: number;
  regenMinutes: number;
}

export interface CafeState {
  count: number;
  /** Epoch ms the count is valid at; the next Café arrives `regenMinutes` after it (while not full). */
  at: number;
}

const regenMs = (config: CafeConfig): number => config.regenMinutes * 60_000;

/** The state at `now`: +1 for each full interval since `at`, up to the maximum. */
export function regenCafe(state: CafeState, now: number, config: CafeConfig): CafeState {
  const held = Math.min(Math.max(0, Math.floor(state.count)), config.max);
  if (held >= config.max) return { count: config.max, at: now };
  const gained = Math.floor(Math.max(0, now - state.at) / regenMs(config));
  if (gained === 0) return { count: held, at: Math.min(state.at, now) };
  const count = Math.min(config.max, held + gained);
  // At the maximum the clock stops; otherwise the leftover part of the interval is kept.
  return { count, at: count >= config.max ? now : state.at + gained * regenMs(config) };
}

/** When the next Café arrives, or null when full. Expects a state already regenerated. */
export function cafeNextAt(state: CafeState, config: CafeConfig): number | null {
  return state.count >= config.max ? null : state.at + regenMs(config);
}

/** One Café less, or null when there is none at `now`. Spending from a full bar starts the clock. */
export function spendCafe(state: CafeState, now: number, config: CafeConfig): CafeState | null {
  const current = regenCafe(state, now, config);
  if (current.count < 1) return null;
  return { count: current.count - 1, at: current.at };
}

/** Adds up to `amount` Café without passing the maximum; `added` is what fit. */
export function addCafe(state: CafeState, amount: number, now: number, config: CafeConfig): { state: CafeState; added: number } {
  const current = regenCafe(state, now, config);
  const added = Math.max(0, Math.min(Math.floor(amount), config.max - current.count));
  const count = current.count + added;
  return { state: { count, at: count >= config.max ? now : current.at }, added };
}

/** Fills the bar (a graduation). */
export function refillCafe(now: number, config: CafeConfig): CafeState {
  return { count: config.max, at: now };
}
