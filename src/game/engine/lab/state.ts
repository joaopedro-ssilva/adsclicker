import { createStream } from '../../../hackathon/engine/rng';
import type { Stream } from '../../../hackathon/engine/rng';
import { LAB_RARITIES } from '../../content/labTypes';
import type { LabBuffDef, LabItemBase, LabNodeDef, LabRarity, LabRarityDef, LabEnemyDef } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { LabCounters, LabRun, LabState, LabTurma } from './types';

export function createLabCounters(): LabCounters {
  return {
    runs: 0,
    broken: 0,
    phasesCleared: 0,
    bossesBeaten: 0,
    itemsFound: 0,
    itemsRecycled: 0,
    itemLevelUps: 0,
    affixRerolls: 0,
    clicks: 0,
    commitsEarned: 0,
  };
}

export function createLabTurma(): LabTurma {
  return { run: null, equipped: {}, nextUid: 1 };
}

export function createLabState(): LabState {
  return { unlocked: false, open: false, commits: 0, tree: {}, treeVersion: LAB_TREE_VERSION, bestPhase: 0, bestPhaseBuild: [], bestRunBuild: [], counters: createLabCounters(), turma: createLabTurma() };
}

/** A run that has just begun: the first phase is spawned by startLabRun. */
export function createLabRun(seed: number, integrity: number): LabRun {
  return {
    seed: seed >>> 0,
    status: 'fighting',
    phase: 1,
    t: 0,
    phaseTime: 0,
    carry: 0,
    integrity,
    maxIntegrity: integrity,
    mobs: [],
    mobSeq: 0,
    waveHp: 0,
    bossLeft: null,
    nextCharge: 0,
    offers: [],
    pending: null,
    buffs: {},
    clickTimes: [],
    windUsed: 0,
    cleared: 0,
    bosses: 0,
    clearLog: [],
    brokenBy: null,
    paid: 0,
  };
}

// ---------------------------------------------------------------------------
// Lookups, built once per GameContent
// ---------------------------------------------------------------------------

export interface LabIndex {
  bases: Map<string, LabItemBase>;
  rarities: Map<string, LabRarityDef>;
  /** Rank of each rarity, comum = 0. */
  rank: Record<LabRarity, number>;
  enemies: Map<string, LabEnemyDef>;
  buffs: Map<string, LabBuffDef>;
  nodes: Map<string, LabNodeDef>;
  /** Bases that can drop, in content order. */
  droppable: LabItemBase[];
}

const cache = new WeakMap<GameContent, LabIndex>();

export function labIndex(content: GameContent): LabIndex {
  let index = cache.get(content);
  if (!index) {
    const rank = {} as Record<LabRarity, number>;
    LAB_RARITIES.forEach((id, i) => {
      rank[id] = i;
    });
    index = {
      bases: new Map(content.lab.bases.map((base) => [base.id, base])),
      rarities: new Map(content.lab.rarities.map((rarity) => [rarity.id, rarity])),
      rank,
      enemies: new Map(content.lab.enemies.map((enemy) => [enemy.id, enemy])),
      buffs: new Map(content.lab.buffs.map((buff) => [buff.id, buff])),
      nodes: new Map(content.lab.tree.map((node) => [node.id, node])),
      droppable: content.lab.bases.filter((base) => base.drops),
    };
    cache.set(content, index);
  }
  return index;
}

/** The bases that can drop in this phase, in content order: the advanced ones wait for their `fromPhase`. */
export function droppableAt(content: GameContent, phase: number): LabItemBase[] {
  return labIndex(content).droppable.filter((base) => (base.fromPhase ?? 1) <= phase);
}

// ---------------------------------------------------------------------------
// Seeded streams
// ---------------------------------------------------------------------------

/** One stream per kind of roll, so what the player does never shifts an unrelated roll. */
export const LAB_STREAM = { wave: 1, offers: 2, reroll: 3, starter: 4 } as const;
export type LabStreamKind = (typeof LAB_STREAM)[keyof typeof LAB_STREAM];

/** The stream of one roll: the same seed, kind and index always give the same sequence. */
export function labStream(seed: number, kind: LabStreamKind, index: number): Stream {
  return createStream(seed, kind * 1_000_003 + index);
}
