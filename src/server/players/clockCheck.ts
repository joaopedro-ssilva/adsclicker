/**
 * The game-clock check (docs/BACKEND.md, "Relógio do jogo"). A speedhack (a script that makes
 * `Date.now` / `performance.now` run fast) makes the game believe more time passed than really did,
 * so production, buffs, cooldowns and offline gain all run fast without the save looking odd: the
 * coin check only knows how much the state can earn per second, and it is deliberately generous.
 *
 * What the speedhack cannot fake is the server's own clock. The save says how much game time went
 * by (`counters.playSeconds`, which the engine adds tick by tick and never for time spent away), and
 * the server knows how much real time went by between two syncs of the same player. Honest play
 * always claims less than it was given: a tab that sleeps or is throttled claims nothing for the
 * gap, and a gap the engine pays as offline gain is not counted as play. So the claim is held to
 * `CLOCK_RATE_LIMIT` times the real time, and what goes beyond it piles up in a leaky bucket kept on
 * the player's row. One short sync can never mark anybody: only an excess that keeps coming does.
 */
import type { GameState } from '@/game/engine/state';

/**
 * Game seconds one real second may claim before the excess starts piling up. Honest play is at 1 or
 * below; the margin covers a client clock stepped forward by a few seconds (NTP, a manual fix) and
 * the way syncs are timed. Also the most a sustained cheat can keep without being caught (+20%).
 */
// Loosened on 2026-10-20: the Laboratório, the Pós-doc and the late items made honest play much faster.
export const CLOCK_RATE_LIMIT = 1.5;

/** Seconds ignored in every sync: network latency changes between two syncs, a clock a moment off. */
export const CLOCK_SLACK_SECONDS = 5;

/**
 * Most one sync can add to the bucket, besides its own real time. A client clock that jumps once (a
 * wrong clock fixed in the middle of a session) is a single event: it cannot fill the bucket by itself
 * in a short window. A cheat adds this much on every sync, so it fills it fast all the same.
 */
export const CLOCK_SYNC_EXCESS_CAP_SECONDS = 30;

/** Seconds of excess game time that mark the player: at 2x speed, about half an hour of play. */
export const CLOCK_EXCESS_LIMIT_SECONDS = 900;

/** The limit once the client itself reported that its clock is patched (a much weaker pile is enough). */
export const CLOCK_EXCESS_LIMIT_PATCHED_SECONDS = 300;

export type ClockVerdict =
  | {
      /** False when there was nothing to compare with (first sync, rollback, forced overwrite). */
      judged: boolean;
      suspect: false;
      /** The bucket to store. */
      excessSeconds: number;
    }
  | {
      judged: true;
      suspect: true;
      excessSeconds: number;
      reason: string;
    };

export interface ClockInput {
  /** The stored save before this sync; null when there is no baseline (first sync, rollback). */
  previous: GameState | null;
  next: GameState;
  /** Server clock milliseconds since the previous accepted sync. */
  elapsedMs: number;
  /** The bucket as stored (0 for a player that never exceeded). */
  excessSeconds: number;
  /** The client reported that its clock functions are not native. */
  patched?: boolean;
  /**
   * An explicit overwrite (the player chose their other device's save): the two saves are not one
   * line of play, so game time is not comparable with real time. The bucket is left alone.
   */
  forced?: boolean;
}

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

/** Updates the bucket with one sync and says whether it is now full. Pure: the caller stores `excessSeconds`. */
export function judgeClock({ previous, next, elapsedMs, excessSeconds, patched = false, forced = false }: ClockInput): ClockVerdict {
  const stored = Math.max(0, finite(excessSeconds));
  if (!previous || forced) return { judged: false, suspect: false, excessSeconds: stored };

  const real = Math.max(0, finite(elapsedMs)) / 1000;
  const claimed = Math.max(0, finite(next.counters.playSeconds) - finite(previous.counters.playSeconds));
  const over = claimed - real * CLOCK_RATE_LIMIT - CLOCK_SLACK_SECONDS;
  // What the sync adds is bounded, so a single odd window cannot fill the bucket; what it takes
  // away is not (idle time pays the debt back, but never builds up credit: the floor is 0).
  const added = Math.min(over, real + CLOCK_SYNC_EXCESS_CAP_SECONDS);
  const bucket = Math.max(0, stored + added);

  const limit = patched ? CLOCK_EXCESS_LIMIT_PATCHED_SECONDS : CLOCK_EXCESS_LIMIT_SECONDS;
  if (bucket < limit) return { judged: true, suspect: false, excessSeconds: bucket };

  const ratio = real > 0 ? claimed / real : Infinity;
  const reason = `game clock ahead of the server clock: ${Math.round(bucket)} s over ${CLOCK_RATE_LIMIT}x (last sync ${Math.round(claimed)} s of play in ${Math.round(real)} s${
    Number.isFinite(ratio) ? `, ${ratio.toFixed(2)}x` : ''
  })${patched ? ', client reports a patched clock' : ''}`;
  // The mark is the record; the bucket starts over, so an admin who clears the mark is not re-flagged by the old excess.
  return { judged: true, suspect: true, excessSeconds: 0, reason };
}
