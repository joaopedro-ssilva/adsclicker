import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import type { SimOptions } from '@/game/sim/simulate';
import { roundTrip } from '../testing/play';
import type { Window } from '../testing/play';
import { judgeSave } from './plausibility';

/** Plays with Edécio, Gladimir and Wagner at the top level (the simulator uses every charge as soon as it is ready). */
function maestriaWindows(options: SimOptions & { windows: number; windowSeconds?: number }): Window[] {
  const { windows, windowSeconds = 45, ...sim } = options;
  const result: Window[] = [];
  let previous: GameState | null = null;
  let live: GameState | undefined;
  for (let i = 0; i < windows; i += 1) {
    const run = simulate(content, {
      ...sim,
      from: live,
      setup: (state) => {
        state.counters.graduations = 30;
        state.diplomasEarned = 20_000;
        for (const id of ['edecio', 'gladimir', 'wagner'] as const) state.maestria.levels[id] = 5;
      },
      maxSeconds: windowSeconds * (i + 1),
      stopWhenDone: false,
    });
    live = run.finalState;
    const next = roundTrip(live);
    result.push({ previous, next, elapsedMs: windowSeconds * 1000 });
    previous = next;
  }
  return result;
}

describe('judgeSave: Maestrias', () => {
  it('honest play with every built Maestria maxed passes, windows of 45 s and of 10 min', () => {
    for (const options of [
      { clicksPerSecond: 14, windows: 60, seed: 3 },
      { clicksPerSecond: 4, windows: 8, windowSeconds: 600, seed: 5, graduate: false },
    ]) {
      // The first window has no baseline and would be judged on the 20,000 diplomas the setup injects.
      const failures = maestriaWindows(options)
        .filter((window) => window.previous !== null)
        .map((window, index) => ({ index, verdict: judgeSave(window) }))
        .filter(({ verdict }) => !verdict.ok);
      expect(failures).toEqual([]);
    }
  }, 240_000);

  const last = () => {
    const windows = maestriaWindows({ clicksPerSecond: 4, windows: 6, seed: 1 });
    const window = windows.at(-1);
    if (!window?.previous) throw new Error('need two windows');
    return window as Window & { previous: GameState };
  };

  it('a Maestria level with no slot behind it', () => {
    const { previous, next, elapsedMs } = last();
    next.counters.graduations = 1; // three Maestrias, one graduation
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('Maestria levels paid with diplomas that were never earned', () => {
    const { previous, next, elapsedMs } = last();
    next.diplomasEarned = 100;
    next.diplomas = 0;
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('coins from a jump the Maestria cannot pay', () => {
    const { previous, next, elapsedMs } = last();
    next.maestria.levels = {};
    next.lifetimeCoins = next.lifetimeCoins.add(previous.lifetimeCoins.mul(1e6));
    next.runCoins = next.runCoins.add(previous.lifetimeCoins.mul(1e6));
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('more diplomas than the cap lets one graduation pay', () => {
    const { previous, next, elapsedMs } = last();
    next.counters.graduations = previous.counters.graduations + 1;
    next.diplomasEarned = previous.diplomasEarned + 1_000_000;
    next.diplomas = next.diplomasEarned;
    next.runCoins = previous.runCoins;
    next.lifetimeCoins = previous.lifetimeCoins.mul(1e60);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('more clicks than the engine accepts (the click limit)', () => {
    const { previous, next, elapsedMs } = last();
    const limit = content.balance.clickLimit?.perSecond ?? 20;
    next.counters.clicks = previous.counters.clicks + Math.ceil(limit * (elapsedMs / 1000 + 30) + 200);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });
});
