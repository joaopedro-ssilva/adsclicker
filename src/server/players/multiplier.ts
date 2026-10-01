import { MAX_DEV_MULTIPLIER, MIN_DEV_MULTIPLIER } from '@/game/engine/state';

/** What the game must apply: the global event times this player's own multiplier, within the engine's bounds. */
export function effectiveMultiplier(event: number, own: number): number {
  return Math.min(MAX_DEV_MULTIPLIER, Math.max(MIN_DEV_MULTIPLIER, event * own));
}
