import type { GameState } from '../state';
import { maestriaActive } from './slots';

/**
 * Moves every recharge timer forward by `ms`, as if that time had passed: ability cooldowns, the next
 * sprint offer, the next invasion, the Super invasão charge, the Festa de lançamento and the recharge of Joinha de Ouro. This is where a Maestria with a timer
 * of its own joins the Rollforward. Countdowns that are running are not here.
 */
export function shiftMaestriaTimers(state: GameState, ms: number): void {
  for (const id in state.abilityReadyAt) {
    const readyAt = state.abilityReadyAt[id] ?? 0;
    if (readyAt > 0) state.abilityReadyAt[id] = Math.max(0, readyAt - ms);
  }
  if (state.sprint.nextOffersAt > 0) state.sprint.nextOffersAt = Math.max(1, state.sprint.nextOffersAt - ms);
  // With an invasion on stage the field is stale (it is rescheduled when that one ends): leave it.
  if (!state.invasion && state.nextInvasionAt > 0) state.nextInvasionAt = Math.max(1, state.nextInvasionAt - ms);
  // A switched-off Maestria is paused: the jump must not fill its charge or end its recharge.
  if (maestriaActive(state, 'wagner') && state.maestria.swarm.since > 0) state.maestria.swarm.since = Math.max(1, state.maestria.swarm.since - ms);
  // Joinha de Ouro: only the recharge moves, never below the end of the mode (an active mode keeps its countdown).
  const joinha = state.maestria.joinha;
  if (maestriaActive(state, 'edecio') && joinha.readyAt > 0) joinha.readyAt = Math.max(joinha.activeUntil, joinha.readyAt - ms);
  if (maestriaActive(state, 'guto') && state.maestria.festa.since > 0) state.maestria.festa.since = Math.max(1, state.maestria.festa.since - ms);
}
