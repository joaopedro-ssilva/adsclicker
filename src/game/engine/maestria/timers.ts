import type { GameState } from '../state';

/**
 * Moves every recharge timer forward by `ms`, as if that time had passed: ability cooldowns, the next
 * sprint offer, the next invasion and the Super invasão charge. This is where a Maestria with a timer
 * of its own (the second wave) joins the Rollforward. Countdowns that are running are not here.
 */
export function shiftMaestriaTimers(state: GameState, ms: number): void {
  for (const id in state.abilityReadyAt) {
    const readyAt = state.abilityReadyAt[id] ?? 0;
    if (readyAt > 0) state.abilityReadyAt[id] = Math.max(0, readyAt - ms);
  }
  if (state.sprint.nextOffersAt > 0) state.sprint.nextOffersAt = Math.max(1, state.sprint.nextOffersAt - ms);
  // With an invasion on stage the field is stale (it is rescheduled when that one ends): leave it.
  if (!state.invasion && state.nextInvasionAt > 0) state.nextInvasionAt = Math.max(1, state.nextInvasionAt - ms);
  if (state.maestria.swarm.since > 0) state.maestria.swarm.since = Math.max(1, state.maestria.swarm.since - ms);
}
