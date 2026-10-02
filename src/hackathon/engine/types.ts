/**
 * Contracts of the Hackathon engine: the shapes shared by the simulation, the server and the UI,
 * and (at the end) the functions `src/hackathon/engine/index.ts` must export.
 * The engine is pure TypeScript: no React, no DOM, no database, no clock, no Math.random.
 */
import type { ProfessorId } from '@/game/content/types';
import type {
  CargoId,
  DailyModifierDef,
  HackathonContent,
  ItemRarity,
  MetaId,
  SlotId,
  StatId,
  Stats,
  UniqueEffect,
} from '../content/types';

/** One simulation step. Every time inside a run is counted in ticks. */
export const TICK_MS = 100;

// ---------------------------------------------------------------------------
// Items owned by a player
// ---------------------------------------------------------------------------

export interface RolledAffix {
  target: StatId | MetaId;
  op: 'add' | 'pct';
  value: number;
  /** Where the roll landed inside its range, 0 to 100. */
  quality: number;
}

export interface ItemInstance {
  id: string;
  /** ItemBaseDef id. */
  base: string;
  rarity: ItemRarity;
  /** Level of the stage that dropped it; scales the values. */
  level: number;
  /** The first affix is the base's primary one. */
  affixes: RolledAffix[];
  /** Average quality of the affixes, 0 to 100. */
  quality: number;
  /** How many times an affix of this item was rerolled (each one doubles the next price). */
  rerolls: number;
  /** Epoch ms. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Build: everything that decides a fight
// ---------------------------------------------------------------------------

/** What the server reads from the database to compute a build. The client never sends it. */
export interface BuildInput {
  cargo: CargoId;
  level: number;
  /** Skill node id -> levels owned. */
  skillNodes: Record<string, number>;
  mentors: Partial<Record<ProfessorId, number>>;
  equipped: Partial<Record<SlotId, ItemInstance>>;
  /** Active skills chosen by the player, at most the cargo's `skillSlots`. */
  activeSkills: string[];
}

export interface Build {
  stats: Stats;
  /** Every MetaId, in percent (0 = no bonus). */
  meta: Record<MetaId, number>;
  /** Active skills usable in the fight: the chosen ones plus any granted by a legendary item. */
  skills: string[];
  /** Unique effects of the equipped legendary items. */
  uniques: UniqueEffect[];
  /** Set id -> pieces equipped, for sets with at least 2. */
  sets: Record<string, number>;
}

// ---------------------------------------------------------------------------
// A run (one attempt at a stage)
// ---------------------------------------------------------------------------

/** A stage ready to be fought: a campaign stage as is, or the daily one generated from the date. */
export interface ResolvedStage {
  /** StageDef id, or "daily". */
  id: string;
  name: string;
  level: number;
  boss: boolean;
  waves: string[][];
  drops: string[];
  xp: number;
  commits: number;
  arena: string;
  /** Rules of the day (daily stage only). */
  modifiers: DailyModifierDef[];
}

export interface RunSetup {
  /** 32-bit unsigned integer. */
  seed: number;
  build: Build;
  stage: ResolvedStage;
  /** Skills fire by themselves at HackathonConfig.autoSkillPower; `skill` actions are ignored. */
  auto: boolean;
}

/** What the player did, stamped with the tick it happened in. Invalid actions are ignored. */
export type RunAction =
  | { tick: number; kind: 'flow' }
  | { tick: number; kind: 'skill'; skill: string }
  | { tick: number; kind: 'choice'; option: 0 | 1 | 2 };

export interface EnemyState {
  /** Unique inside the run, stable for animations. */
  uid: number;
  /** EnemyDef id. */
  def: string;
  hp: number;
  maxHp: number;
  /** Tick at which a charged hit lands, or null when not charging. */
  chargeLandsAt: number | null;
}

export type RunPhase = 'fighting' | 'choosing' | 'won' | 'lost';

/** Everything the arena needs to draw one frame. Plain data, replaced (not mutated) each step. */
export interface RunState {
  tick: number;
  phase: RunPhase;
  /** 0-based index of the current wave, in the order the seed shuffled them. */
  wave: number;
  waveCount: number;
  player: {
    hp: number;
    maxHp: number;
    /** The next hit is a guaranteed crit. */
    flowReady: boolean;
    /** Earliest tick a new `flow` action is accepted. */
    flowAvailableAt: number;
    /** A block is up until this tick (0 = none). */
    blockUntil: number;
    hasteUntil: number;
    stunned: boolean;
  };
  enemies: EnemyState[];
  /** One entry per usable skill. */
  skills: { id: string; readyAt: number }[];
  /** WaveBuffDef ids on offer while `phase` is 'choosing', else null. */
  offer: [string, string, string] | null;
  /** WaveBuffDef ids picked so far in this run. */
  buffs: string[];
  /** Ticks left for the wave when an enemy has the `timer` trait, else null. */
  waveTicksLeft: number | null;
}

/** What happened in a step, for animation and sound. Never needed to compute the next step. */
export type FightEvent =
  | { type: 'waveStart'; wave: number; enemies: EnemyState[] }
  | { type: 'playerHit'; target: number; damage: number; crit: boolean; flow: boolean; killed: boolean }
  | { type: 'enemyHit'; source: number; damage: number; charged: boolean; blocked: boolean }
  | { type: 'chargeStart'; source: number; landsAt: number }
  | { type: 'stunned' }
  | { type: 'skill'; skill: string; auto: boolean }
  | { type: 'heal'; amount: number }
  | { type: 'spawn'; enemies: EnemyState[] }
  | { type: 'secondWind' }
  | { type: 'waveCleared'; wave: number }
  | { type: 'offer'; options: [string, string, string] }
  | { type: 'buffPicked'; buff: string }
  | { type: 'end'; won: boolean; reason: 'cleared' | 'defeated' | 'timeout' };

/** An ongoing run. `state` is safe to hand to React; the rest is the engine's own. */
export interface Run {
  readonly setup: RunSetup;
  state: RunState;
}

export interface RunOutcome {
  won: boolean;
  reason: 'cleared' | 'defeated' | 'timeout';
  wavesCleared: number;
  ticks: number;
  hpLeft: number;
}

// ---------------------------------------------------------------------------
// Loot and progression
// ---------------------------------------------------------------------------

export interface DropContext {
  stage: ResolvedStage;
  build: Build;
  /** First victory on this stage: one drop is at least HackathonConfig.firstClear.minRarity. */
  firstClear: boolean;
  /** Victories since the last legendary. */
  pity: number;
  /** Returns a float in [0, 1). The server passes a crypto-backed generator. */
  rng: () => number;
  /** Epoch ms, stamped on the items. */
  now: number;
  /** Makes item ids; the server passes a UUID generator. */
  newId: () => string;
}

export interface DropResult {
  items: ItemInstance[];
  /** The pity counter after these drops. */
  pity: number;
}

export interface LevelProgress {
  level: number;
  xp: number;
  levelsGained: number;
}

export interface ClassroomBonus {
  cargo: number;
  mentors: Partial<Record<ProfessorId, number>>;
}

/**
 * The functions `src/hackathon/engine/index.ts` exports. Signatures are fixed: the server and
 * the UI are written against them.
 */
export interface HackathonEngine {
  computeBuild(input: BuildInput, content: HackathonContent): Build;

  /** A campaign stage by id, or the daily stage for `dateKey` ("2026-10-02") when id is "daily". Null when unknown. */
  resolveStage(id: string, dateKey: string, content: HackathonContent): ResolvedStage | null;

  createRun(setup: RunSetup, content: HackathonContent): Run;
  /**
   * Advances one tick with the actions of that tick and returns what happened. While the phase is
   * 'choosing' time is frozen: nothing happens until a `choice` action arrives. After 'won' or
   * 'lost' it does nothing.
   */
  stepRun(run: Run, actions: RunAction[], content: HackathonContent): FightEvent[];
  /** Runs a whole stage from the recorded actions (a missing choice picks option 0). Used by the server. */
  simulateRun(setup: RunSetup, actions: RunAction[], content: HackathonContent): RunOutcome;

  rollDrops(context: DropContext, content: HackathonContent): DropResult;
  /** A copy of the item with the affix at `index` rolled again (never the primary, index 0). */
  rerollAffix(item: ItemInstance, index: number, rng: () => number, content: HackathonContent): ItemInstance;
  rerollCost(item: ItemInstance, content: HackathonContent): number;
  recycleValue(item: ItemInstance, content: HackathonContent): number;
  /** A single number to rank items by (rarity first, then quality and level). */
  itemScore(item: ItemInstance, content: HackathonContent): number;

  xpToNext(level: number, content: HackathonContent): number;
  /** Adds XP, levelling up to the cargo's cap (XP past the cap is kept at the cap, never lost below it). */
  applyXp(current: { cargo: CargoId; level: number; xp: number }, amount: number, content: HackathonContent): LevelProgress;
  /** Skill points earned (1 per level above 1) minus the ones spent on nodes. */
  freeSkillPoints(level: number, skillNodes: Record<string, number>, content: HackathonContent): number;
  /** Why a node level cannot be bought (pt-BR, ready to show), or null when it can. */
  nodeLock(node: string, level: number, skillNodes: Record<string, number>, content: HackathonContent): string | null;
  /** Commits for the next level of a mentor, or null when maxed. */
  mentorCost(professor: ProfessorId, level: number, content: HackathonContent): number | null;
  classroomBonus(input: { cargo: CargoId; mentors: Partial<Record<ProfessorId, number>> }, content: HackathonContent): ClassroomBonus;
}
