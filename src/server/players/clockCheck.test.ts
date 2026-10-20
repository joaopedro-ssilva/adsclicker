import { describe, expect, it } from 'vitest';
import { coinsPerSecond, statsOf } from '@/game/engine';
import { content } from '@/game/content';
import type { GameState } from '@/game/engine/state';
import { playWindows, roundTrip } from '../testing/play';
import {
  CLOCK_EXCESS_LIMIT_PATCHED_SECONDS,
  CLOCK_EXCESS_LIMIT_SECONDS,
  CLOCK_RATE_LIMIT,
  CLOCK_SLACK_SECONDS,
  CLOCK_SYNC_EXCESS_CAP_SECONDS,
  judgeClock,
} from './clockCheck';
import type { ClockVerdict } from './clockCheck';
import { judgeSave } from './plausibility';

const [first, second] = playWindows({ windows: 2, seed: 1, clicksPerSecond: 4 });
if (!first || !second) throw new Error('need two windows');
const firstSave = first.next;
const secondSave = second.next;
const midgame =playWindows({ windows: 60, seed: 1, clicksPerSecond: 1 });

/** A previous/next pair of saves where `next` claims `claimed` more seconds of play than `previous`. */
function pair(claimed: number): { previous: GameState; next: GameState } {
  const previous = roundTrip(firstSave);
  const next = roundTrip(secondSave);
  next.counters.playSeconds = previous.counters.playSeconds + claimed;
  return { previous, next };
}

/** Runs one sync after another, each of `realSeconds` of server time claiming `claimedSeconds` of play. */
function run(syncs: number, realSeconds: number, claimedSeconds: number, options: { patched?: boolean; start?: number } = {}) {
  const { previous, next } = pair(claimedSeconds);
  let excess = options.start ?? 0;
  for (let i = 1; i <= syncs; i += 1) {
    const verdict: ClockVerdict = judgeClock({ previous, next, elapsedMs: realSeconds * 1000, excessSeconds: excess, patched: options.patched });
    excess = verdict.excessSeconds;
    if (verdict.suspect) return { syncs: i, verdict, excess };
  }
  return { syncs: null, verdict: null, excess };
}

describe('judgeClock: honest play never accumulates', () => {
  it('claims what the server clock gave (one game second per real second), for a day of 45 s syncs', () => {
    const result = run(24 * 80, 45, 45);
    expect(result.syncs).toBeNull();
    expect(result.excess).toBe(0);
  });

  it('claims less than the time given: a throttled tab, a slept laptop (the gap is offline gain, not play)', () => {
    expect(run(100, 45, 20).excess).toBe(0);
    expect(run(1, 3600, 0).excess).toBe(0);
    expect(run(1, 6 * 3600, 90).excess).toBe(0);
  });

  it('a client clock a few seconds fast, or sync times a second off, stays under the margin', () => {
    // 45 s windows claiming 48 s: +3 s every sync is exactly the slack.
    expect(run(2000, 45, 48).syncs).toBeNull();
    // 45 s windows claiming just under the rate limit plus the slack: still honest as far as the check can tell.
    expect(run(2000, 45, Math.floor(45 * CLOCK_RATE_LIMIT + CLOCK_SLACK_SECONDS)).syncs).toBeNull();
  });

  it('syncs in quick succession (event syncs, a few seconds apart) are not penalised', () => {
    expect(run(500, 8, 8).syncs).toBeNull();
    expect(run(500, 0.5, 1).syncs).toBeNull();
  });
});

describe('judgeClock: a speedhack is caught only when it is sustained', () => {
  it('3x speed (a pasted userscript) marks the player after a sustained pile, never on the first syncs', () => {
    const result = run(200, 45, 135);
    expect(result.syncs).not.toBeNull();
    // Each 45 s sync adds (claimed - rate * real - slack) to the bucket, until the limit is reached.
    const perSync = Math.min(135 - 45 * CLOCK_RATE_LIMIT - CLOCK_SLACK_SECONDS, 45 + CLOCK_SYNC_EXCESS_CAP_SECONDS);
    expect(result.syncs!).toBe(Math.ceil(CLOCK_EXCESS_LIMIT_SECONDS / perSync));
    expect(result.syncs!).toBeGreaterThanOrEqual(5);
    expect(result.verdict).toMatchObject({ suspect: true, excessSeconds: 0 });
    expect((result.verdict as { reason: string }).reason).toMatch(/game clock ahead of the server clock/);
  });

  it('a single short sync never marks anyone, however wild the claim', () => {
    for (const claimed of [90, 500, 3600, 86_400]) {
      const verdict = judgeClock({ ...pair(claimed), elapsedMs: 45_000, excessSeconds: 0 });
      expect(verdict.suspect).toBe(false);
      expect(verdict.excessSeconds).toBeLessThanOrEqual(45 + CLOCK_SYNC_EXCESS_CAP_SECONDS);
      expect(verdict.excessSeconds).toBeLessThan(CLOCK_EXCESS_LIMIT_SECONDS);
    }
  });

  it('a one-off clock jump (a wrong clock fixed mid-session) in a short window is a single event', () => {
    // An hour of game time inside a 45 s window, once, followed by honest play.
    const jump = judgeClock({ ...pair(3600), elapsedMs: 45_000, excessSeconds: 0 });
    expect(jump.suspect).toBe(false);
    const after = run(100, 45, 45, { start: jump.excessSeconds });
    expect(after.syncs).toBeNull();
    expect(after.excess).toBe(0);
  });

  it('faster hacks are caught sooner, slower ones later', () => {
    const at = (claimed: number) => run(2000, 45, claimed).syncs ?? Infinity;
    const edge = 45 * CLOCK_RATE_LIMIT + CLOCK_SLACK_SECONDS; // the claim per 45 s sync that adds nothing
    expect(at(450)).toBeLessThanOrEqual(at(180)); // 10x vs 4x (both hit the per-sync cap)
    expect(at(180)).toBeLessThan(at(135)); // 4x vs 3x
    expect(at(135)).toBeLessThan(at(90)); // 3x vs 2x
    expect(at(90)).toBeLessThan(2000); // 2x is still caught within a day
    // A claim a little over the edge leaves little per sync, so it takes more than an hour.
    const slow = Math.ceil(edge + 5);
    expect(at(slow)).toBeLessThan(2000);
    expect(at(slow) * 45).toBeGreaterThan(3600);
    // A claim at the edge hides inside the margin on 45 s windows: the most a sustained hack can keep.
    expect(at(Math.floor(edge))).toBe(Infinity);
  });

  it('a long window that claims more than twice the real time marks at once: it is hours of it', () => {
    const verdict = judgeClock({ ...pair(7200), elapsedMs: 3600_000, excessSeconds: 0 });
    expect(verdict.suspect).toBe(true);
  });

  it('the bucket is paid back by honest syncs and never builds credit below zero', () => {
    // A few minutes of a 3x hack, then honest play: the excess drains and nothing is flagged.
    const hack = run(5, 45, 135);
    expect(hack.syncs).toBeNull();
    expect(hack.excess).toBeGreaterThan(100);
    const honest = run(100, 45, 45, { start: hack.excess });
    expect(honest.syncs).toBeNull();
    expect(honest.excess).toBe(0);
    // Idle time (the tab closed for an hour) pays it back too, and only down to zero.
    expect(run(1, 3600, 0, { start: hack.excess }).excess).toBe(0);
    // No credit is banked: after the idle hour a 3x hack starts from zero again.
    const again = run(200, 45, 135, { start: run(1, 3600, 0, { start: hack.excess }).excess });
    expect(again.syncs).toBe(run(200, 45, 135).syncs);
  });

  it('a client that reports a patched clock is marked sooner, with the report in the reason', () => {
    const plain = run(200, 45, 135);
    const reported = run(200, 45, 135, { patched: true });
    expect(reported.syncs!).toBeLessThan(plain.syncs!);
    expect(reported.syncs!).toBeGreaterThanOrEqual(Math.floor(CLOCK_EXCESS_LIMIT_PATCHED_SECONDS / (45 + CLOCK_SYNC_EXCESS_CAP_SECONDS)));
    expect((reported.verdict as { reason: string }).reason).toMatch(/patched clock/);
  });

  it('a patched client that plays honestly is not marked by the report alone', () => {
    expect(run(2000, 45, 45, { patched: true }).syncs).toBeNull();
  });
});

describe('judgeClock: nothing to compare with', () => {
  it('the first sync, a rollback and a forced overwrite leave the bucket alone', () => {
    const { previous, next } = pair(100_000);
    expect(judgeClock({ previous: null, next, elapsedMs: 0, excessSeconds: 42 })).toEqual({ judged: false, suspect: false, excessSeconds: 42 });
    expect(judgeClock({ previous, next, elapsedMs: 45_000, excessSeconds: 42, forced: true })).toEqual({ judged: false, suspect: false, excessSeconds: 42 });
  });

  it('survives garbage numbers', () => {
    const { previous, next } = pair(45);
    expect(judgeClock({ previous, next, elapsedMs: Number.NaN, excessSeconds: Number.NaN })).toMatchObject({ suspect: false });
    expect(judgeClock({ previous, next, elapsedMs: -5_000, excessSeconds: -10 })).toMatchObject({ suspect: false, excessSeconds: CLOCK_SYNC_EXCESS_CAP_SECONDS });
  });

  it('the rate limit is a sane margin over honest play', () => {
    expect(CLOCK_RATE_LIMIT).toBeGreaterThan(1);
    expect(CLOCK_RATE_LIMIT).toBeLessThanOrEqual(1.5);
  });
});

describe('judgeSave: offline returns cannot pay for more time than went by', () => {
  /** A window of honest play, with an offline return added: `next` is richer by `awaySeconds` of offline pay. */
  function withOffline(awaySeconds: number, returns = 1) {
    // Gladimir is the professor who brings offline earnings.
    // Forty-five minutes in, when idle production (not clicking) is what the state earns.
    const [before, after] = midgame.slice(-2);
    if (!before || !after) throw new Error('need two windows');
    const previous = roundTrip(before.next);
    const next = roundTrip(after.next);
    previous.hired.gladimir = true;
    next.hired.gladimir = true;
    const stats = statsOf(next, content);
    const cps = coinsPerSecond(next, content);
    const paid = cps.mul(Math.min(awaySeconds, stats.offlineHours * 3600) * stats.offlineRate * returns);
    next.counters.offlineCollections = previous.counters.offlineCollections + returns;
    next.lifetimeCoins = next.lifetimeCoins.add(paid);
    next.runCoins = next.runCoins.add(paid);
    return { previous, next: roundTrip(next), stats };
  }

  it('an offline return for the time that really passed is fine', () => {
    const { previous, next } = withOffline(40);
    expect(judgeSave({ previous, next, elapsedMs: 45_000 })).toMatchObject({ ok: true });
  });

  it('a clock pushed forward for several full caps of offline gain inside a minute is refused', () => {
    // Three full returns: the loosened production slack alone covers one, but not what a clock pushed forward collects.
    const { previous, next, stats } = withOffline(24 * 3600, 3);
    // The cap this state can collect is far beyond what a 45 s window could have paid.
    expect(stats.offlineHours * 3600 * stats.offlineRate).toBeGreaterThan(45);
    expect(judgeSave({ previous, next, elapsedMs: 45_000 }).ok).toBe(false);
  });

  it('a forced overwrite (the other device\'s save) keeps the generous bound', () => {
    const { previous, next } = withOffline(24 * 3600, 3);
    expect(judgeSave({ previous, next, elapsedMs: 45_000, forced: true })).toMatchObject({ ok: true });
  });
});
