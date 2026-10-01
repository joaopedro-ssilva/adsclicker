import type { GameContent, InvasionDef } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { grantReward } from './rewards';
import { recordSprintEvent } from './sprints';
import type { GameState } from './state';
import { computeStats, hasFeature } from './stats';

/** Keeps invasions away from the very edge of the stage. */
const STAGE_MARGIN = 0.1;

export function scheduleNextInvasion(state: GameState, content: GameContent, now: number, rng: () => number): void {
  const { minIntervalMs, maxIntervalMs } = content.balance.events;
  const stats = computeStats(state, content);
  const interval = minIntervalMs + rng() * Math.max(0, maxIntervalMs - minIntervalMs);
  state.nextInvasionAt = now + interval * stats.eventInterval;
}

function pickInvasion(content: GameContent, rng: () => number): InvasionDef | null {
  const pool = content.invasions.filter((def) => def.weight > 0);
  const total = pool.reduce((sum, def) => sum + def.weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const def of pool) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return pool[pool.length - 1] ?? null;
}

function spawn(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  const def = pickInvasion(content, rng);
  if (!def) {
    scheduleNextInvasion(state, content, now, rng);
    return;
  }
  const stats = computeStats(state, content);
  state.invasionSeq += 1;
  state.invasion = {
    uid: state.invasionSeq,
    def: def.id,
    spawnedAt: now,
    expiresAt: now + def.windowMs * stats.eventWindow,
    clicksLeft: def.clicksRequired,
    x: STAGE_MARGIN + rng() * (1 - 2 * STAGE_MARGIN),
    y: STAGE_MARGIN + rng() * (1 - 2 * STAGE_MARGIN),
  };
  emit({ type: 'invasionSpawn', uid: state.invasion.uid, def: def.id });
}

/** Spawns, schedules and expires invasions. Without the `events` feature there are none. */
export function updateInvasions(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  if (!hasFeature(state, content, 'events')) {
    state.invasion = null;
    return;
  }

  const current = state.invasion;
  if (current && now >= current.expiresAt) {
    state.counters.eventsMissed += 1;
    state.eventStreak = 0;
    state.invasion = null;
    emit({ type: 'invasionMissed', uid: current.uid, def: current.def });
    scheduleNextInvasion(state, content, now, rng);
    return;
  }
  if (state.invasion) return;

  if (state.nextInvasionAt <= 0) scheduleNextInvasion(state, content, now, rng);
  else if (now >= state.nextInvasionAt) spawn(state, content, now, rng, emit);
}

/** One click on the invasion on stage. The last required click defends it and pays the reward. */
export function hitInvasion(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): boolean {
  const current = state.invasion;
  if (!current || now >= current.expiresAt) return false;
  const def = getIndex(content).invasions.get(current.def);
  if (!def) {
    state.invasion = null;
    return false;
  }

  current.clicksLeft -= 1;
  emit({ type: 'invasionHit', uid: current.uid, clicksLeft: Math.max(0, current.clicksLeft) });
  if (current.clicksLeft > 0) return true;

  state.invasion = null;
  state.eventStreak += 1;
  state.counters.eventsDefended += 1;
  state.counters.bestEventStreak = Math.max(state.counters.bestEventStreak, state.eventStreak);
  recordSprintEvent(state, content, { kind: 'defendEvents', amount: 1 });
  const reward = grantReward(state, content, def.reward, 'invasion', now, emit);
  emit({ type: 'invasionDefended', uid: current.uid, def: def.id, reward, streak: state.eventStreak });
  scheduleNextInvasion(state, content, now, rng);
  return true;
}
