import type { BuffDef, GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { isAbilityUnlocked } from './requirements';
import type { ActiveBuff, GameState } from './state';
import { computeStats } from './stats';
import type { Stats } from './stats';

/**
 * Starts a buff, or refreshes its timer when it is already active. Duration is scaled by the
 * abilityDuration stat, which covers every buff regardless of where it came from.
 */
export function startBuff(
  state: GameState,
  buff: BuffDef,
  source: ActiveBuff['source'],
  stats: Stats,
  now: number,
  emit: Emit,
): ActiveBuff {
  const active: ActiveBuff = {
    id: buff.id,
    name: buff.name,
    emoji: buff.emoji,
    effects: buff.effects,
    startedAt: now,
    endsAt: now + buff.durationMs * stats.abilityDuration,
    source,
  };
  const existing = state.buffs.findIndex((b) => b.id === buff.id);
  if (existing >= 0) state.buffs[existing] = active;
  else state.buffs.push(active);
  emit({ type: 'buffStart', id: buff.id });
  return active;
}

/** Removes buffs that ended at or before `now`. Returns true when any was removed. */
export function expireBuffs(state: GameState, now: number, emit: Emit): boolean {
  if (!state.buffs.some((buff) => buff.endsAt <= now)) return false;
  const expired = state.buffs.filter((buff) => buff.endsAt <= now);
  state.buffs = state.buffs.filter((buff) => buff.endsAt > now);
  for (const buff of expired) emit({ type: 'buffEnd', id: buff.id });
  return true;
}

export function abilityCooldownLeft(state: GameState, id: string, now: number): number {
  return Math.max(0, (state.abilityReadyAt[id] ?? 0) - now);
}

/** Uses an ability: applies its buff and starts the cooldown. Returns false when it is locked or cooling down. */
export function activateAbility(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const def = getIndex(content).abilities.get(id);
  if (!def || !isAbilityUnlocked(state, content, def)) return false;
  if (abilityCooldownLeft(state, id, now) > 0) return false;

  const stats = computeStats(state, content);
  state.abilityReadyAt[id] = now + def.cooldownMs * stats.abilityCooldown;
  state.counters.abilitiesUsed += 1;
  emit({ type: 'abilityUsed', id });
  startBuff(state, def.buff, 'ability', stats, now, emit);
  return true;
}
