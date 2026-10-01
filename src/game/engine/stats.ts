import { PROFESSOR_IDS } from '../content/types';
import type { Effect, Feature, GameContent, ProfessorId } from '../content/types';
import { getIndex } from './contentIndex';
import type { Decimal } from './decimal';
import type { GameState } from './state';

/** Synergy bonus per other hired professor once the `synergy` feature is on (BalanceConfig has no field for it). */
export const BASE_SYNERGY = 0.05;

/**
 * Final value of every stat. Each one is `(base + sum of 'add') * product of 'mult'`, where the
 * effects come from bought research, prestige nodes (add x level, mult ^ level) and active buffs.
 *
 * Base of each StatKey:
 *
 * | StatKey            | Base                                                                   |
 * | ------------------ | ---------------------------------------------------------------------- |
 * | globalPower        | 1, then x (1 + achievementBonus * achievements) x (1 + bonusPerDiploma * diplomasEarned) |
 * | clickPower         | 1                                                                      |
 * | idlePower          | 1                                                                      |
 * | prof:<id>          | 1                                                                      |
 * | disc:<id>          | 1                                                                      |
 * | clickFromIdle      | 0                                                                      |
 * | critChance         | balance.crit.baseChance with the `combo` feature, else 0 (clamped 0..1) |
 * | critMult           | balance.crit.baseMult                                                  |
 * | comboMax           | balance.combo.baseMax with the `combo` feature, else 0                 |
 * | comboStep          | balance.combo.baseStep                                                 |
 * | autoClicks         | 0                                                                      |
 * | offlineHours       | balance.offline.baseHours with the `offline` feature, else 0           |
 * | offlineRate        | balance.offline.baseRate with the `offline` feature, else 0 (clamped 0..1) |
 * | costMult           | 1                                                                      |
 * | costGrowth         | balance.costGrowth, never below balance.minCostGrowth                  |
 * | activeBonus        | balance.activeBonus                                                    |
 * | eventInterval      | 1                                                                      |
 * | eventWindow        | 1                                                                      |
 * | eventReward        | 1                                                                      |
 * | abilityCooldown    | 1                                                                      |
 * | abilityDuration    | 1 (scales the duration of every buff: abilities, invasion and sprint rewards) |
 * | sprintReward       | 1                                                                      |
 * | synergy            | BASE_SYNERGY (5%) with the `synergy` feature, else 0                   |
 * | diplomaGain        | 1                                                                      |
 */
export interface Stats {
  globalPower: number;
  clickPower: number;
  idlePower: number;
  clickFromIdle: number;
  critChance: number;
  critMult: number;
  comboMax: number;
  comboStep: number;
  autoClicks: number;
  offlineHours: number;
  offlineRate: number;
  costMult: number;
  /** Per-level cost growth already clamped to balance.minCostGrowth. */
  costGrowth: number;
  activeBonus: number;
  eventInterval: number;
  eventWindow: number;
  eventReward: number;
  abilityCooldown: number;
  abilityDuration: number;
  sprintReward: number;
  synergy: number;
  diplomaGain: number;
  /** Multiplier of each professor's disciplines. */
  prof: Record<ProfessorId, number>;
  /** Multiplier of single disciplines. Only ids with effects are present; use discMult(). */
  disc: Record<string, number>;
}

export function discMult(stats: Stats, disciplineId: string): number {
  return stats.disc[disciplineId] ?? 1;
}

class Accumulator {
  private adds = new Map<string, number>();
  private mults = new Map<string, number>();

  push(effects: readonly Effect[], levels = 1): void {
    for (const effect of effects) {
      if (effect.op === 'add') {
        this.adds.set(effect.stat, (this.adds.get(effect.stat) ?? 0) + effect.value * levels);
      } else {
        this.mults.set(effect.stat, (this.mults.get(effect.stat) ?? 1) * effect.value ** levels);
      }
    }
  }

  value(stat: string, base: number): number {
    return (base + (this.adds.get(stat) ?? 0)) * (this.mults.get(stat) ?? 1);
  }

  /** Ids of the stats named `disc:<id>` that have at least one effect. */
  discIds(): string[] {
    const ids = new Set<string>();
    for (const key of [...this.adds.keys(), ...this.mults.keys()]) {
      if (key.startsWith('disc:')) ids.add(key.slice(5));
    }
    return [...ids];
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A feature is on when a hired professor lists it. */
export function hasFeature(state: GameState, content: GameContent, feature: Feature): boolean {
  for (const id of PROFESSOR_IDS) {
    if (state.hired[id] && content.professors[id].features.includes(feature)) return true;
  }
  return false;
}

export function achievementCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

export function computeStats(state: GameState, content: GameContent): Stats {
  const index = getIndex(content);
  const { balance } = content;
  const acc = new Accumulator();

  for (const id in state.research) {
    if (state.research[id]) {
      const def = index.research.get(id);
      if (def) acc.push(def.effects);
    }
  }
  for (const id in state.prestige) {
    const levels = state.prestige[id] ?? 0;
    const def = index.prestigeNodes.get(id);
    if (def && levels > 0) acc.push(def.effects, levels);
  }
  for (const buff of state.buffs) acc.push(buff.effects);

  const on = (feature: Feature) => hasFeature(state, content, feature);
  const combo = on('combo');
  const offline = on('offline');

  const prof = {} as Record<ProfessorId, number>;
  for (const id of PROFESSOR_IDS) prof[id] = acc.value(`prof:${id}`, 1);
  const disc: Record<string, number> = {};
  for (const id of acc.discIds()) disc[id] = acc.value(`disc:${id}`, 1);

  return {
    globalPower:
      acc.value('globalPower', 1) *
      (1 + balance.achievementBonus * achievementCount(state)) *
      (1 + balance.graduation.bonusPerDiploma * state.diplomasEarned),
    clickPower: acc.value('clickPower', 1),
    idlePower: acc.value('idlePower', 1),
    clickFromIdle: Math.max(0, acc.value('clickFromIdle', 0)),
    critChance: clamp(acc.value('critChance', combo ? balance.crit.baseChance : 0), 0, 1),
    critMult: Math.max(1, acc.value('critMult', balance.crit.baseMult)),
    comboMax: Math.max(0, acc.value('comboMax', combo ? balance.combo.baseMax : 0)),
    comboStep: Math.max(0, acc.value('comboStep', balance.combo.baseStep)),
    autoClicks: Math.max(0, acc.value('autoClicks', 0)),
    offlineHours: Math.max(0, acc.value('offlineHours', offline ? balance.offline.baseHours : 0)),
    offlineRate: clamp(acc.value('offlineRate', offline ? balance.offline.baseRate : 0), 0, 1),
    costMult: Math.max(0, acc.value('costMult', 1)),
    costGrowth: Math.max(balance.minCostGrowth, acc.value('costGrowth', balance.costGrowth)),
    activeBonus: acc.value('activeBonus', balance.activeBonus),
    eventInterval: Math.max(0.05, acc.value('eventInterval', 1)),
    eventWindow: Math.max(0.05, acc.value('eventWindow', 1)),
    eventReward: Math.max(0, acc.value('eventReward', 1)),
    abilityCooldown: Math.max(0.05, acc.value('abilityCooldown', 1)),
    abilityDuration: Math.max(0.05, acc.value('abilityDuration', 1)),
    sprintReward: Math.max(0, acc.value('sprintReward', 1)),
    synergy: Math.max(0, acc.value('synergy', on('synergy') ? BASE_SYNERGY : 0)),
    diplomaGain: Math.max(0, acc.value('diplomaGain', 1)),
    prof,
    disc,
  };
}

// ---------------------------------------------------------------------------
// Per-reference cache for view builders, which run on every render. Engine mutators call
// invalidateStats() when they finish, and the store publishes a new top-level reference after
// each mutation, so a hit is always fresh. Engine code itself must call computeStats() directly.
// ---------------------------------------------------------------------------

/** Derived values shared by the views of one state reference; filled lazily by economy.ts. */
export interface StateCache {
  content: GameContent;
  stats: Stats;
  coinsPerSecond: Decimal | null;
  clickValue: Decimal | null;
}

const cache = new WeakMap<GameState, StateCache>();

export function getStateCache(state: GameState, content: GameContent): StateCache {
  const hit = cache.get(state);
  if (hit && hit.content === content) return hit;
  const fresh: StateCache = { content, stats: computeStats(state, content), coinsPerSecond: null, clickValue: null };
  cache.set(state, fresh);
  return fresh;
}

export function cachedStats(state: GameState, content: GameContent): Stats {
  return getStateCache(state, content).stats;
}

export function invalidateStats(state: GameState): void {
  cache.delete(state);
}
