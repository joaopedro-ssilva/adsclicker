import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { coinsPerSecond } from '@/game/engine';
import { bolsaMaxSeconds, horasMaxDiplomas } from '@/game/engine/maestria';
import { capBase, maxAngeloCapFactor } from '@/game/engine/prestige';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import type { SimOptions } from '@/game/sim/simulate';
import { roundTrip } from '../testing/play';
import type { Window } from '../testing/play';
import { joinhaClickFactor } from './maestriaBounds';
import { judgeSave } from './plausibility';

/** Plays with all eight Maestrias at the top level (the simulator uses every charge as soon as it is ready and trades the Bolsa). */
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
        for (const id of PROFESSOR_IDS) state.maestria.levels[id] = 5;
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
  it('honest play with all eight Maestrias maxed passes, windows of 45 s and of 10 min', () => {
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

  it("Edécio's golden mode raises the click ceiling by the part of the window it can be on, and only with the Maestria", () => {
    const { previous, next, elapsedMs } = last();
    const window = { clicks: 10 * 75, seconds: 75 };
    const cfg = content.maestrias.joinha;
    const solo = roundTrip(next);
    solo.maestria.levels = { edecio: 5 }; // no Rollforward to shorten the recharge
    const level5 = joinhaClickFactor(solo, content, window);
    // 75 s hold one run of 20 s (the mode may already be on at the start): 1 + (3 - 1) x 20 / 75.
    expect(level5).toBeCloseTo(1 + ((cfg.multiplier[4] ?? 1) - 1) * ((cfg.seconds[4] ?? 0) / 75), 3);
    expect(level5).toBeLessThan(cfg.multiplier[4] ?? 1);
    // A long window gets more runs but a smaller share of it; a window shorter than the mode is capped at the multiplier.
    expect(joinhaClickFactor(solo, content, { clicks: 10 * 630, seconds: 630 })).toBeLessThan(level5);
    expect(joinhaClickFactor(solo, content, { clicks: 10, seconds: 5 })).toBeCloseTo(cfg.multiplier[4] ?? 1, 5);
    // With the Rollforward's charges the recharge can be skipped, which counts as more time.
    expect(joinhaClickFactor(next, content, window)).toBeGreaterThan(level5);
    const without = roundTrip(next);
    delete without.maestria.levels.edecio;
    expect(joinhaClickFactor(without, content, window)).toBe(1);

    // The same save is judged against a lower ceiling without the Maestria.
    const prevWithout = roundTrip(previous);
    delete prevWithout.maestria.levels.edecio;
    const withMaestria = judgeSave({ previous, next: roundTrip(next), elapsedMs });
    const withoutMaestria = judgeSave({ previous: prevWithout, next: without, elapsedMs });
    if (!withMaestria.ok || !withoutMaestria.ok) throw new Error('both should pass');
    expect(withoutMaestria.ratio).toBeGreaterThan(withMaestria.ratio);
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

  it('Bolsa profit far beyond what the market can pay in the window', () => {
    const { previous, next, elapsedMs } = last();
    const cps = coinsPerSecond(next, content);
    const window = elapsedMs / 1000 + 30;
    const lump = cps.mul(bolsaMaxSeconds(content, 5, window) * 40);
    next.lifetimeCoins = next.lifetimeCoins.add(lump);
    next.runCoins = next.runCoins.add(lump);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it('more diplomas than the cap plus the Horas complementares bands', () => {
    const { previous, next, elapsedMs } = last();
    const cap = content.balance.graduation.cap;
    if (!cap) throw new Error('no cap');
    next.counters.graduations = previous.counters.graduations + 1;
    const allowed = (capBase(content, previous.counters.graduations) ?? 0) * maxAngeloCapFactor(content, false) + horasMaxDiplomas(content, 5);
    next.diplomasEarned = previous.diplomasEarned + Math.ceil(allowed) + 10;
    next.lifetimeCoins = previous.lifetimeCoins.mul(1e60);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });

  it("Angelo's honour stretches the cap the server allows, but only once he has been honoured", () => {
    const { previous, next, elapsedMs } = last();
    const cap = content.balance.graduation.cap;
    if (!cap) throw new Error('no cap');
    const base = capBase(content, previous.counters.graduations) ?? 0;
    const horas = horasMaxDiplomas(content, 5);
    const stretched = Math.floor(base * maxAngeloCapFactor(content, true)) + horas;
    const plain = Math.ceil(base * maxAngeloCapFactor(content, false)) + horas;
    expect(stretched).toBeGreaterThan(plain + 2);
    const attempt = (honoured: boolean, diplomas: number) => {
      const copy = roundTrip(next);
      copy.counters.graduations = previous.counters.graduations + 1;
      copy.diplomasEarned = previous.diplomasEarned + diplomas;
      copy.honouredBefore = { ...copy.honouredBefore, angelo: honoured };
      const verdict = judgeSave({ previous: { ...previous, honouredBefore: { ...previous.honouredBefore, angelo: honoured } }, next: copy, elapsedMs });
      return verdict.ok ? '' : verdict.reason;
    };
    const between = plain + 2; // above the plain ceiling, below the honoured one
    expect(attempt(false, between)).toContain('cap allows');
    expect(attempt(true, between)).not.toContain('cap allows');
    expect(attempt(true, stretched + 5)).toContain('cap allows');
  });

  it('more clicks than the engine accepts (the click limit)', () => {
    const { previous, next, elapsedMs } = last();
    const limit = content.balance.clickLimit?.perSecond ?? 20;
    next.counters.clicks = previous.counters.clicks + Math.ceil(limit * (elapsedMs / 1000 + 30) + 200);
    expect(judgeSave({ previous, next: roundTrip(next), elapsedMs }).ok).toBe(false);
  });
});
