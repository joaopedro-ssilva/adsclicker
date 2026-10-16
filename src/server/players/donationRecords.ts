/**
 * Plausibility of the Centro Comunitário total (docs/BACKEND.md, "Centro Comunitário"): the ADScoins given to the
 * campus (`state.donated`), shown on the donors board. The checks run inside `judgeSave`, so a failure flags the
 * player like any other and takes them off every board.
 *
 * What holds for honest play:
 * - A donation spends coins, and coins were earned, so the total never beats the lifetime coins.
 * - The total never goes down (a rollback or a forced overwrite has no baseline and is judged like a first sync).
 * - Between two syncs the player can give at most the coins they had in hand at the first one plus what they earned
 *   since (graduating empties the hand, which only lowers what is left to give). The earnings are the growth of the
 *   lifetime coins, already bounded by the production test, so the total is bounded by the same clock.
 */
import type { Decimal } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { BACKWARDS_TOLERANCE } from './plausibility';

export interface DonationRecordsInput {
  previous: GameState | null;
  next: GameState;
  /** Lifetime coins gained in the window (all of them for a first sync). */
  gain: Decimal;
}

/** Null when the total is plausible, the reason otherwise. */
export function judgeDonations({ previous, next, gain }: DonationRecordsInput): string | null {
  const slack = next.lifetimeCoins.mul(BACKWARDS_TOLERANCE);
  if (next.donated.gt(next.lifetimeCoins.add(slack))) return 'donated above the lifetime coins';
  if (!previous) return null;
  if (next.donated.lt(previous.donated.mul(1 - BACKWARDS_TOLERANCE))) return 'donated went backwards';
  const grew = next.donated.sub(previous.donated);
  if (grew.gt(previous.coins.add(gain).add(slack))) return 'donated more than the coins available';
  return null;
}
