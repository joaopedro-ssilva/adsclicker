import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { MONITOR_IDS } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import type { SimOptions } from '@/game/sim/simulate';
import { roundTrip } from '../testing/play';
import type { Window } from '../testing/play';
import { judgeSave } from './plausibility';

/**
 * Monitores automate purchases, defences and sprints but create no coins out of nothing: they only
 * buy what the coins already allow, and a defence or a sprint pays at most what the player's own
 * would. So judgeSave needs no change for them; this plays the real content with every monitor at
 * its top level and checks that each sync still passes.
 */
function monitoredWindows(options: SimOptions & { windows: number; windowSeconds?: number }): Window[] {
  const { windows, windowSeconds = 45, ...sim } = options;
  const result: Window[] = [];
  let previous: GameState | null = null;
  let live: GameState | undefined;
  for (let i = 0; i < windows; i += 1) {
    const run = simulate(content, {
      ...sim,
      from: live,
      setup: (state) => {
        state.counters.graduations = 1;
        for (const def of content.monitors) state.monitors.units[def.id].level = def.levels.length;
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

describe('judgeSave: play with every monitor at its top level', () => {
  const profiles = [
    { name: 'casual', options: { clicksPerSecond: 1, defendRate: 0.3 } },
    { name: 'graduating', options: { clicksPerSecond: 4, graduate: true, graduateMinDiplomas: 1 } },
  ];

  for (const profile of profiles) {
    it(`${profile.name}: every 45 s window of 60 minutes passes, and the monitors really worked`, () => {
      const windows = monitoredWindows({ ...profile.options, windows: 80, seed: 3 });
      const failures = windows
        .map((window, index) => ({ index, verdict: judgeSave(window) }))
        .filter(({ verdict }) => !verdict.ok);
      expect(failures).toEqual([]);

      const last = windows.at(-1)?.next;
      const done = MONITOR_IDS.map((id) => last?.monitors.units[id].done ?? 0);
      expect(done[0]).toBeGreaterThan(0); // Compras
      expect(done[3]).toBeGreaterThan(0); // Pesquisa
    }, 180_000);
  }
});
