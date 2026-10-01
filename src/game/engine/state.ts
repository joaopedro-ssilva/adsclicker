import type Decimal from 'break_infinity.js';
import type { CounterKey, Effect, ProfessorId } from '../content/types';

/** Bump when the saved shape changes and add a migration in save.ts. */
export const SAVE_VERSION = 1;

export type BuyAmount = 1 | 10 | 'max';

/** Bounds of Settings.devMultiplier (the /admin coin multiplier). */
export const MIN_DEV_MULTIPLIER = 0.1;
export const MAX_DEV_MULTIPLIER = 1_000_000;

export interface ActiveBuff {
  /** BuffDef id. Applying a buff that is already active refreshes its timer. */
  id: string;
  name: string;
  emoji: string;
  effects: Effect[];
  startedAt: number;
  endsAt: number;
  source: 'ability' | 'invasion' | 'sprint';
}

export interface ActiveInvasion {
  /** Unique per spawn, so the UI can key animations. */
  uid: number;
  /** InvasionDef id. */
  def: string;
  spawnedAt: number;
  expiresAt: number;
  clicksLeft: number;
  /** Position on the stage, 0..1 on each axis. */
  x: number;
  y: number;
}

export interface ActiveSprint {
  /** SprintDef id. */
  def: string;
  startedAt: number;
  endsAt: number;
  progress: number;
  target: number;
  /**
   * Only for 'earnSeconds' goals: the coins/second measured at acceptance, as a Decimal string.
   * Progress then counts seconds of that production earned, so it never overflows a number.
   */
  refCps?: string;
}

export interface Settings {
  /** 0..1 */
  sfxVolume: number;
  /** 0..1. Music starts off. */
  musicVolume: number;
  muted: boolean;
  musicEnabled: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  floatingNumbers: boolean;
  /**
   * Admin/dev knob: multiplies every source of coins. 1 in normal play.
   * Set from the /admin page for demos and quick progression tests.
   */
  devMultiplier: number;
}

/**
 * The whole game in one serialisable object. Engine functions mutate it in place;
 * the store publishes a fresh top-level reference after each mutation.
 * All timestamps are epoch milliseconds.
 */
export interface GameState {
  version: number;

  // Currencies
  coins: Decimal;
  /** Coins produced since the last graduation; decides the diplomas of the next one. */
  runCoins: Decimal;
  lifetimeCoins: Decimal;
  /** Diplomas available to spend. */
  diplomas: number;
  /** Diplomas ever earned; each one gives a permanent global bonus. */
  diplomasEarned: number;

  // Faculty
  hired: Record<ProfessorId, boolean>;
  /** The professor on stage: the click target. */
  activeProfessor: ProfessorId;

  // Purchases
  /** Levels of disciplines and click upgrades, by id. Missing = 0. */
  levels: Record<string, number>;
  research: Record<string, boolean>;
  /** Levels of prestige nodes, by id. Survives graduation. */
  prestige: Record<string, number>;
  buyAmount: BuyAmount;

  // Collection (survives graduation)
  /** Achievement id -> unlock timestamp. */
  achievements: Record<string, number>;
  /** Secret triggers that already fired. */
  secrets: Record<string, boolean>;
  skins: Record<string, boolean>;
  equippedSkin: Record<ProfessorId, string>;
  sceneries: Record<string, boolean>;
  equippedScenery: string;
  themes: Record<string, boolean>;
  equippedTheme: string;

  // Click layer
  combo: { steps: number; lastClickAt: number };
  /** Fractional automatic clicks carried between ticks. */
  autoClickCarry: number;

  // Timed systems
  buffs: ActiveBuff[];
  /** Ability id -> timestamp when it can be used again. */
  abilityReadyAt: Record<string, number>;
  invasion: ActiveInvasion | null;
  nextInvasionAt: number;
  /** Counter behind ActiveInvasion.uid. */
  invasionSeq: number;
  eventStreak: number;
  sprint: {
    /** SprintDef ids currently on offer. */
    offers: string[];
    active: ActiveSprint | null;
    /** When a new set of offers appears after a sprint ends. */
    nextOffersAt: number;
  };

  /** Lifetime counters. Survive graduation. */
  counters: Record<CounterKey, number>;

  settings: Settings;

  /** Throttles the full achievement scan done by the tick (about once per second). */
  lastAchievementCheckAt: number;

  createdAt: number;
  lastTickAt: number;
  lastSavedAt: number;
}
