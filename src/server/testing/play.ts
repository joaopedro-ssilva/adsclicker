import { content } from '@/game/content';
import { deserializeState, serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import type { SimOptions } from '@/game/sim/simulate';

/** What the server would hold after a sync: the state read back from its serialized form. */
export function roundTrip(state: GameState, now = state.lastTickAt): GameState {
  const copy = deserializeState(serializeState(state), content, now);
  if (!copy) throw new Error('save did not round-trip');
  return copy;
}

export interface Window {
  previous: GameState | null;
  next: GameState;
  elapsedMs: number;
}

/**
 * Plays the real content with the simulator and snapshots it every `windowSeconds`, the way the
 * game syncs: each window pairs the save the server would hold with the one it receives next.
 */
export function playWindows(options: SimOptions & { windows: number; windowSeconds?: number }): Window[] {
  const { windows, windowSeconds = 45, ...sim } = options;
  const result: Window[] = [];
  let previous: GameState | null = null;
  let live: GameState | undefined;
  for (let i = 0; i < windows; i += 1) {
    // maxSeconds is the total play time since the start of the simulation, not per call.
    const run = simulate(content, { ...sim, from: live, maxSeconds: windowSeconds * (i + 1), stopWhenDone: false });
    live = run.finalState;
    const next = roundTrip(live);
    result.push({ previous, next, elapsedMs: windowSeconds * 1000 });
    previous = next;
  }
  return result;
}
