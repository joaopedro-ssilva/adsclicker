import { describe, expect, it } from 'vitest';
import { Decimal } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { playWindows, roundTrip } from '../testing/play';
import { isRollback, judgeSave } from './plausibility';

function lastWindow(options: Parameters<typeof playWindows>[0]) {
  const windows = playWindows(options);
  const last = windows.at(-1);
  if (!last?.previous) throw new Error('need at least two windows');
  return { previous: last.previous, next: last.next, elapsedMs: last.elapsedMs };
}

describe('judgeSave: honest play passes', () => {
  const profiles = [
    { name: 'casual', options: { clicksPerSecond: 1, defendRate: 0.3 } },
    { name: 'active', options: { clicksPerSecond: 4, defendRate: 0.8 } },
    { name: 'fast clicker', options: { clicksPerSecond: 14, defendRate: 1 } },
    { name: 'graduating', options: { clicksPerSecond: 4, graduate: true, graduateMinDiplomas: 1 } },
  ];

  for (const profile of profiles) {
    it(`${profile.name}: every 45 s window of 90 minutes of play`, () => {
      const windows = playWindows({ ...profile.options, windows: 120, seed: 3 });
      const failures = windows
        .map((window, index) => ({ index, verdict: judgeSave(window) }))
        .filter(({ verdict }) => !verdict.ok);
      expect(failures).toEqual([]);
    }, 120_000);
  }

  it('a player who syncs rarely (10 minute windows) still passes', () => {
    const windows = playWindows({ clicksPerSecond: 4, windows: 20, windowSeconds: 600, seed: 5 });
    for (const window of windows) expect(judgeSave(window)).toMatchObject({ ok: true });
  }, 120_000);

  it('first sync of an existing save is judged by its own play time', () => {
    const [first] = playWindows({ clicksPerSecond: 4, windows: 1, windowSeconds: 3600, seed: 2 });
    expect(first).toBeDefined();
    expect(judgeSave({ previous: null, next: first!.next, elapsedMs: 0 })).toMatchObject({ ok: true });
  }, 60_000);

  it('a first sync after graduations, with offline returns, passes', () => {
    const [first] = playWindows({
      clicksPerSecond: 4,
      windows: 1,
      windowSeconds: 4 * 3600,
      graduateMinDiplomas: 1,
      away: { playSeconds: 900, awaySeconds: 3600 },
      seed: 4,
    });
    expect(judgeSave({ previous: null, next: first!.next, elapsedMs: 0 })).toMatchObject({ ok: true });
  }, 60_000);
});

describe('judgeSave: tampering fails', () => {
  const base = () => lastWindow({ clicksPerSecond: 4, windows: 10, seed: 1 });

  it('coins multiplied by hand', () => {
    const { previous, next, elapsedMs } = base();
    next.lifetimeCoins = next.lifetimeCoins.mul(1e9);
    next.runCoins = next.runCoins.mul(1e9);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('levels pushed up without the time to earn them', () => {
    const { previous, next, elapsedMs } = base();
    for (const id of Object.keys(next.levels)) next.levels[id] = 500;
    next.lifetimeCoins = new Decimal('1e60');
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('a hand-edited first save claiming a huge fortune in a few minutes of play', () => {
    const { next } = base();
    next.lifetimeCoins = new Decimal('1e80');
    next.counters.playSeconds = 600;
    expect(judgeSave({ previous: null, next: roundTrip(next), elapsedMs: 0 }).ok).toBe(false);
  });

  it('a first sync with coins out of proportion to its play time', () => {
    const { next } = lastWindow({ clicksPerSecond: 4, windows: 80, seed: 1 });
    expect(judgeSave({ previous: null, next: roundTrip(next), elapsedMs: 0 }).ok).toBe(true);
    next.lifetimeCoins = next.lifetimeCoins.mul(1e4);
    next.runCoins = next.runCoins.mul(1e4);
    expect(judgeSave({ previous: null, next: roundTrip(next), elapsedMs: 0 }).ok).toBe(false);
  });

  it('counters going backwards', () => {
    const edits: ((state: GameState) => void)[] = [
      (state) => {
        state.counters.clicks = 0;
      },
      (state) => {
        state.counters.graduations = 0;
      },
      (state) => {
        state.diplomasEarned = 0;
      },
    ];
    for (const edit of edits) {
      const { previous, next, elapsedMs } = base();
      previous.counters.graduations = 2;
      previous.diplomasEarned = 5;
      previous.counters.clicks = Math.max(previous.counters.clicks, 10);
      next.counters.graduations = Math.max(next.counters.graduations, 2);
      next.diplomasEarned = Math.max(next.diplomasEarned, 5);
      edit(next);
      expect(judgeSave({ previous, next, elapsedMs }).ok).toBe(false);
    }
  });

  it('lifetime coins going backwards', () => {
    const { previous, next, elapsedMs } = base();
    next.lifetimeCoins = next.lifetimeCoins.div(2);
    expect(judgeSave({ previous, next, elapsedMs }).ok).toBe(false);
  });

  it('more clicks than a human can make', () => {
    const { previous, next, elapsedMs } = base();
    next.counters.clicks += 5_000;
    expect(judgeSave({ previous, next, elapsedMs }).ok).toBe(false);
  });

  it('diplomas without a graduation, or far more than the run was worth', () => {
    const { previous, next, elapsedMs } = base();
    next.diplomasEarned += 500;
    expect(judgeSave({ previous, next, elapsedMs }).ok).toBe(false);
    next.counters.graduations += 1;
    expect(judgeSave({ previous, next, elapsedMs }).ok).toBe(false);
  });

  it('ten minutes of gain is refused in a 45 s window but accepted after 10 minutes', () => {
    const slow = lastWindow({ clicksPerSecond: 4, windows: 20, windowSeconds: 600, seed: 9 });
    const quick = { ...slow, elapsedMs: 45_000 };
    expect(judgeSave(slow)).toMatchObject({ ok: true });
    expect(judgeSave(quick).ok).toBe(false);
  }, 60_000);
});

describe('judgeSave: the allowances are earned by waiting', () => {
  it('syncing every 5 s does not collect a full grace and reward lump each time', () => {
    const { previous, next } = lastWindow({ clicksPerSecond: 4, windows: 30, windowSeconds: 600, seed: 9 });
    // The same gain claimed in five seconds instead of ten minutes.
    expect(judgeSave({ previous, next, elapsedMs: 5_000 }).ok).toBe(false);
  }, 60_000);
});

describe('isRollback', () => {
  it('is true for older progress and false for newer', () => {
    const { previous, next } = lastWindow({ clicksPerSecond: 4, windows: 6, seed: 2 });
    expect(isRollback(next, previous)).toBe(true);
    expect(isRollback(previous, next)).toBe(false);
    expect(isRollback(next, next)).toBe(false);
  });
});
