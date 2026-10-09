import { FESTA_BUFF_PREFIX } from '../../content/types';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { startBuff } from '../buffs';
import { getIndex } from '../contentIndex';
import { isAbilityUnlocked } from '../requirements';
import type { ActiveBuff, GameState } from '../state';
import { computeStats, hasFeature } from '../stats';
import { atLevel } from './production';
import { maestriaLevel } from './slots';

const MINUTE_MS = 60_000;
/** The first invasion of the party comes this soon (unless one is already due earlier). */
const FIRST_INVASION_MS = 5_000;

/** Real time one recharge takes at the current level, in ms. 0 when Guto's Maestria is not unlocked. */
export function festaRechargeMs(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'guto');
  return level > 0 ? atLevel(content.maestrias.festa.rechargeMinutes, level) * MINUTE_MS : 0;
}

/** 0..1 of the recharge; 1 = ready. */
export function festaCharge(state: GameState, content: GameContent, now: number): number {
  const needed = festaRechargeMs(state, content);
  const { since } = state.maestria.festa;
  if (needed <= 0 || since <= 0) return 0;
  return Math.min(1, Math.max(0, (now - since) / needed));
}

/** The party's buff, while it lasts. */
export function activeFesta(state: GameState, now: number = state.lastTickAt): ActiveBuff | null {
  return state.buffs.find((buff) => buff.id.startsWith(FESTA_BUFF_PREFIX) && buff.endsAt > now) ?? null;
}

export function festaReady(state: GameState, content: GameContent, now: number): boolean {
  return activeFesta(state, now) === null && festaCharge(state, content, now) >= 1;
}

/**
 * Starts the party: the level's buff (everything boosted, abilities recharge faster, invasions come more often)
 * and every unlocked ability fires at once, recharge or not. The abilities it fires are not counted as used by
 * hand (no counter, no "tried" mark), and their buffs carry the Maestria as source, so the achievements that
 * ask for the abilities by hand keep their meaning. The recharge starts again at once.
 */
export function startFesta(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const level = maestriaLevel(state, 'guto');
  if (level <= 0 || !festaReady(state, content, now)) return false;

  const cfg = content.maestrias.festa;
  const buff = cfg.buffs[Math.min(cfg.buffs.length, level) - 1];
  if (!buff) return false;
  state.maestria.festa.since = now;
  state.buffs = state.buffs.filter((entry) => !entry.id.startsWith(FESTA_BUFF_PREFIX));
  state.buffs.push({
    id: buff.id,
    name: buff.name,
    emoji: buff.emoji,
    effects: buff.effects,
    startedAt: now,
    endsAt: now + buff.durationMs,
    source: 'maestria',
  });

  // With the party's stats in force: the abilities recharge at the party's pace, and their buffs last as long as usual.
  const stats = computeStats(state, content);
  let fired = 0;
  for (const ability of getIndex(content).abilities.values()) {
    if (!isAbilityUnlocked(state, content, ability)) continue;
    state.abilityReadyAt[ability.id] = now + ability.cooldownMs * stats.abilityCooldown;
    startBuff(state, ability.buff, 'maestria', stats, now, emit);
    fired += 1;
  }

  // More invasions: the first one is due in a few seconds, the next ones follow the party's interval.
  if (hasFeature(state, content, 'events') && !state.invasion) {
    const due = now + FIRST_INVASION_MS;
    state.nextInvasionAt = state.nextInvasionAt > 0 ? Math.min(state.nextInvasionAt, due) : due;
  }

  emit({ type: 'festaStart', seconds: buff.durationMs / 1000, abilities: fired });
  return true;
}

/** Starts the recharge of a fresh Maestria. */
export function updateFesta(state: GameState, now: number): void {
  if (maestriaLevel(state, 'guto') > 0 && state.maestria.festa.since <= 0) state.maestria.festa.since = now;
}
