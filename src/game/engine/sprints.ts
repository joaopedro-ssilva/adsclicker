import type { GameContent, SprintDef, SprintGoal } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal } from './decimal';
import { clickValueWith, coinsPerSecondWith } from './economy';
import { firstUnmet } from './requirements';
import { grantReward } from './rewards';
import type { ActiveSprint, GameState } from './state';
import { computeStats, hasFeature } from './stats';

/** Progress reported by the rest of the engine; earnSeconds is tracked by economy.gain(). */
export interface SprintEvent {
  kind: Exclude<SprintGoal['kind'], 'earnSeconds'>;
  amount: number;
}

/** Sprints the player may be offered right now: requirements met. */
export function eligibleSprints(state: GameState, content: GameContent): SprintDef[] {
  return content.sprints.filter((def) => firstUnmet(state, content, def.requires) === null);
}

/** Puts a fresh set of sprints on offer when none is active and the cooldown ended. */
export function offerSprints(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  const sprint = state.sprint;
  if (sprint.active || sprint.offers.length > 0 || now < sprint.nextOffersAt) return;
  if (!hasFeature(state, content, 'sprints')) return;

  const pool = eligibleSprints(state, content);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = pool[i];
    const b = pool[j];
    if (a && b) {
      pool[i] = b;
      pool[j] = a;
    }
  }
  sprint.offers = pool.slice(0, content.balance.sprints.offers).map((def) => def.id);
  if (sprint.offers.length > 0) emit({ type: 'sprintOffers' });
}

/** Accepts one of the offered sprints. The other offers are dropped. */
export function acceptSprint(state: GameState, content: GameContent, defId: string, now: number, emit: Emit): boolean {
  const def = getIndex(content).sprints.get(defId);
  if (!def || state.sprint.active || !state.sprint.offers.includes(defId)) return false;
  if (!hasFeature(state, content, 'sprints')) return false;

  const active: ActiveSprint = {
    def: def.id,
    startedAt: now,
    endsAt: now + def.durationMs,
    progress: 0,
    target: def.goal.amount,
  };
  if (def.goal.kind === 'earnSeconds') {
    const stats = computeStats(state, content);
    const reference = Decimal.max(
      coinsPerSecondWith(state, content, stats),
      clickValueWith(state, content, stats),
    );
    active.refCps = reference.toString();
  }
  state.sprint.active = active;
  state.sprint.offers = [];
  emit({ type: 'sprintStart', def: def.id });
  return true;
}

/** Adds progress to the running sprint when its goal matches. Completion is settled by settleSprint(). */
export function recordSprintEvent(state: GameState, content: GameContent, event: SprintEvent): void {
  const active = state.sprint.active;
  if (!active) return;
  const def = getIndex(content).sprints.get(active.def);
  if (!def || def.goal.kind !== event.kind) return;
  if (event.kind === 'reachCombo') active.progress = Math.max(active.progress, event.amount);
  else active.progress += event.amount;
}

/** Completes the running sprint when its goal is met, or fails it when the deadline passed. */
export function settleSprint(state: GameState, content: GameContent, now: number, emit: Emit): void {
  const active = state.sprint.active;
  if (!active) return;
  const def = getIndex(content).sprints.get(active.def);
  const cooldown = content.balance.sprints.cooldownMs;

  if (!def) {
    state.sprint.active = null;
    state.sprint.nextOffersAt = now + cooldown;
    return;
  }
  if (active.progress >= active.target) {
    state.sprint.active = null;
    state.sprint.offers = [];
    state.sprint.nextOffersAt = now + cooldown;
    state.counters.sprintsCompleted += 1;
    const reward = grantReward(state, content, def.reward, 'sprint', now, emit);
    emit({ type: 'sprintDone', def: def.id, reward });
  } else if (now >= active.endsAt) {
    state.sprint.active = null;
    state.sprint.offers = [];
    state.sprint.nextOffersAt = now + cooldown;
    state.counters.sprintsFailed += 1;
    emit({ type: 'sprintFailed', def: def.id });
  }
}
