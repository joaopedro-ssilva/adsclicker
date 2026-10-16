import type Decimal from 'break_infinity.js';
import type { CounterKey, Effect, MonitorId, ProfessorId } from '../content/types';
import type { LabState } from './lab/types';
import type { MaestriaState } from './maestria/types';

/** Bump when the saved shape changes and add a migration in save.ts. */
export const SAVE_VERSION = 1;

export type BuyAmount = 1 | 10 | 'max';

/** Bounds of Settings.devMultiplier (the /admin coin multiplier). */
export const MIN_DEV_MULTIPLIER = 0.1;
export const MAX_DEV_MULTIPLIER = 1_000_000;

/**
 * Permanent bonuses earned in the Hackathon mode. The server owns them: they arrive with each
 * sync and are kept in the save only so that offline time still counts them.
 */
export interface CloudBonus {
  /** Multiplies every source of coins (the student's cargo). */
  cargo: number;
  /** Multiplies the disciplines of one professor (mentor levels). Missing = 1. */
  mentors: Partial<Record<ProfessorId, number>>;
}

export const MAX_CARGO_BONUS = 10;
export const MAX_MENTOR_BONUS = 5;

export interface ActiveBuff {
  /** BuffDef id. Applying a buff that is already active refreshes its timer. */
  id: string;
  name: string;
  emoji: string;
  effects: Effect[];
  startedAt: number;
  endsAt: number;
  source: 'ability' | 'invasion' | 'sprint' | 'maestria';
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
  /** Accepted by the Monitor de Sprints: if it runs out the sprint is not counted as failed. */
  auto?: boolean;
}

/** One hired (or not yet hired) Monitor. Survives graduation. */
export interface MonitorUnit {
  /** 0 = not hired. */
  level: number;
  /** The player's switch. */
  on: boolean;
  /** Compras and Pesquisa: when it acts next. Sprints: when it accepts the offers on screen (0 = no offers seen). */
  nextAt: number;
  /** Times it acted, ever. */
  done: number;
  /** Id of the last thing it bought or accepted, for the card. '' = none. */
  last: string;
}

export type SprintPick = 'first' | 'best' | 'clicks';
export const SPRINT_PICKS: readonly SprintPick[] = ['first', 'best', 'clicks'];
/** Shares of the coins one automatic purchase may spend (Compras and Pesquisa). */
export const MONITOR_SHARES: readonly number[] = [0.1, 0.25, 0.5, 1];

export interface MonitorsState {
  units: Record<MonitorId, MonitorUnit>;
  settings: {
    /** Compras buys only what costs at most this share of the ADScoins in hand. */
    comprasShare: number;
    /** Pesquisa buys only a research that costs at most this share of the ADScoins in hand. */
    pesquisaShare: number;
    /** Which offer the Monitor de Sprints takes. */
    sprintPick: SprintPick;
  };
}

/** Pós-doc: the permanent stars of the professors. Survives graduation. */
export interface PostdocState {
  /** Stars per professor (0..balance.postdoc.maxStars). Only ever grow. */
  stars: Record<ProfessorId, number>;
  /**
   * The graduation count (counters.graduations) when each professor last defended, so it is one per turma: the Domínio
   * comes back with the next turma's levels and must reach the cap again. Missing = never.
   */
  turma: Partial<Record<ProfessorId, number>>;
}

/** Numbers about the current run only. Zeroed at every graduation. */
export interface RunStats {
  /** Seconds of play (offline time excluded). */
  seconds: number;
  /** Clicks on the professor. Automatic clicks do not count. */
  clicks: number;
  levelsBought: number;
  /** Coins earned by clicks, manual and automatic. */
  clickCoins: Decimal;
  sprintsCompleted: number;
  sprintsFailed: number;
  eventsDefended: number;
  eventsMissed: number;
  /** Highest combo step reached in the run. */
  maxCombo: number;
  /**
   * Where the run's coins came from, besides clickCoins (which also holds the automatic clicks). The coins of the
   * classes are what is left of runCoins, so the parts always add up to what the game paid.
   */
  autoClickCoins: Decimal;
  /** Rewards of invasions and swarms. */
  eventCoins: Decimal;
  sprintCoins: Decimal;
  offlineCoins: Decimal;
  /** Bolsa profit and Rollforward jumps. */
  extraCoins: Decimal;
}

/** The personal bests, over every graduation. Zero = not set yet. */
export interface Records {
  /** Seconds of the fastest run that ended in a graduation. */
  fastestSeconds: number;
  mostClicks: number;
  biggestCombo: number;
  /** Most coins earned in one run. */
  mostCoins: Decimal;
}

export type RecordKey = keyof Records;
export const RECORD_KEYS: readonly RecordKey[] = ['fastestSeconds', 'mostClicks', 'biggestCombo', 'mostCoins'];

/** The summary of the run a graduation closed, shown by the graduation scene. Coins are Decimal strings. */
export interface RunSummary {
  /** Diplomas the graduation paid, Horas complementares included. */
  diplomas: number;
  /** Of those, the ones paid by Horas complementares, outside the cap. */
  bonus: number;
  /** The run was worth more diplomas than the cap allowed. */
  capped: boolean;
  /** The honoured professor of the run that ended. */
  honoured: ProfessorId | null;
  maxCombo: number;
  coins: { total: string; classes: string; clicks: string; autoClicks: string; events: string; sprints: string; offline: string; other: string };
  /** Records this run beat (there was a mark before). */
  recordsBeaten: RecordKey[];
  /** Records that had no mark and were set by this run. */
  recordsStarted: RecordKey[];
}

/** One line of the Mural de formaturas: numbers and ids only, so the last ten stay small in the save. */
export interface GraduationRecord {
  /** Which turma this was (counters.graduations after it). */
  number: number;
  /** Epoch ms of the graduation. */
  at: number;
  /** Diplomas paid, Horas complementares included. */
  diplomas: number;
  /** Of those, the ones paid by Horas complementares. */
  bonus: number;
  /** Seconds the run lasted. */
  seconds: number;
  capped: boolean;
  /** The professor honoured DURING the run that ended (what that honour "rendeu"). */
  honoured: ProfessorId | null;
  /** The tree was reset during that run. */
  treeReset: boolean;
}

/** Graduations the Mural keeps. */
export const GRADUATION_HISTORY_MAX = 10;

/** What the run closed by the latest graduation looked like, for the achievements that judge a whole run. */
export interface LastRun {
  seconds: number;
  clicks: number;
  /** Professors with at least one discipline level. */
  investedProfessors: number;
  /** 0..1 share of the run's coins that came from clicks. */
  clickShare: number;
  sprintsCompleted: number;
  sprintsFailed: number;
  eventsDefended: number;
  eventsMissed: number;
  /** Missing in the saves of before the summary existed. */
  summary?: RunSummary;
}

export interface Settings {
  /** 0..1 */
  sfxVolume: number;
  /** 0..1. Music starts off. */
  musicVolume: number;
  muted: boolean;
  musicEnabled: boolean;
  /** The sound of clicking the professor (crit and golden clicks included). Every other effect is unaffected. */
  clickSound: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  floatingNumbers: boolean;
  /** Ambient particles of the sceneries and the glow of mythic skins. The scenery image and the professor stay either way. */
  sceneryEffects: boolean;
  /** Numbers from the decilhão (1e33) up as names ("1,86 Ud") or scientific ("1,86e36"). Below that the names always show. */
  numberNotation: 'names' | 'scientific';
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
  /** ADScoins given to the campus (Centro Comunitário), ever. Survives graduation; decides the donor title. */
  donated: Decimal;
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
  /**
   * The graduation count (counters.graduations) when the tree was last reset, or null if it never was. The reset is
   * allowed once per turma: it is open again as soon as the count moves on.
   */
  treeResetGraduation: number | null;
  /** The last graduations, newest first, at most GRADUATION_HISTORY_MAX. */
  graduationHistory: GraduationRecord[];

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
  /** Starred cosmetics, keyed "skin:<id>", "scenery:<id>" or "theme:<id>" (see favourites.ts). Cosmetic only. */
  favourites: Record<string, boolean>;

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

  cloudBonus: CloudBonus;

  run: RunStats;
  lastRun: LastRun | null;
  /** Personal bests. */
  records: Records;

  /** Honoured professor of the current run, picked at the last graduation. */
  honoured: ProfessorId | null;
  /** Professors ever honoured. */
  honouredBefore: Record<string, boolean>;
  /** Abilities used at least once, ever. */
  abilitiesTried: Record<string, boolean>;

  /** Maestrias: the slots spent, their levels and the runtime of each (see engine/maestria). */
  maestria: MaestriaState;

  /** Pós-doc stars of the professors (see engine/postdoc). */
  postdoc: PostdocState;

  /** Monitores (automation hired with diplomas). Survives graduation. */
  monitors: MonitorsState;

  /** O Laboratório de Pesquisa: unlock, Commits and tree last; the run and the items last until graduation (see engine/lab). */
  lab: LabState;

  /** The current sitting: seconds played and when the player last acted. Restarted at every boot. */
  session: { seconds: number; activeAt: number };
  /** Calendar days (local, as day numbers): the last day played, the streak and the graduations made on gradDay. */
  calendar: { day: number; streak: number; gradDay: number; gradsToday: number };

  /** Throttles the full achievement scan done by the tick (about once per second). */
  lastAchievementCheckAt: number;

  createdAt: number;
  lastTickAt: number;
  lastSavedAt: number;
}
