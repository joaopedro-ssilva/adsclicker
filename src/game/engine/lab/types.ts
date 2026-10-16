import type { LabRarity, LabSlot, LabTarget } from '../../content/labTypes';

/** One rolled line of an item. `value` is what it rolled at item level 1, rarity multiplier included. */
export interface LabAffix {
  target: LabTarget;
  op: 'add' | 'pct';
  value: number;
}

export interface LabItem {
  /** Unique inside the turma (0 while it is only an offer). */
  uid: number;
  /** LabItemBase id. */
  base: string;
  rarity: LabRarity;
  level: number;
  /** The first one is the base's primary affix. Empty for the Mouse quebrado. */
  affixes: LabAffix[];
  /** Affixes of this item rolled again with ADScoins; each one makes the next dearer. */
  rerolls: number;
}

/** One of the options after a phase. Items come already rolled, so the player can see what they pick. */
export type LabOffer =
  | { kind: 'item'; item: LabItem }
  | { kind: 'buff'; buff: string }
  | { kind: 'commits'; amount: number }
  /** Share of the maximum integrity restored. */
  | { kind: 'repair'; share: number };

export interface LabMob {
  uid: number;
  /** EnemyDef id. */
  def: string;
  hp: number;
  maxHp: number;
}

/** fighting: the phase runs · reward: pick one option · equip: a new item is waiting for a decision · broken: the run is over. */
export type LabRunStatus = 'fighting' | 'reward' | 'equip' | 'broken';
export type LabBreakReason = 'timer' | 'integrity';

/** The run of a turma. Everything after a roll comes from `seed`. */
export interface LabRun {
  seed: number;
  status: LabRunStatus;
  /** The phase being fought (1-based). While rewarding it is the phase just cleared. */
  phase: number;
  /** Seconds of the run played (the lab open). */
  t: number;
  /** Seconds into the current phase. */
  phaseTime: number;
  /** Time handed to the run and not simulated yet (less than one step). */
  carry: number;
  integrity: number;
  maxIntegrity: number;
  mobs: LabMob[];
  mobSeq: number;
  /** HP of the whole wave, splits included: the progress bar. */
  waveHp: number;
  /** Seconds left on a boss, or null when the phase has no timer. */
  bossLeft: number | null;
  /** phaseTime of the boss's next charged hit (0 = none). */
  nextCharge: number;
  offers: LabOffer[];
  /** An item taken from the rewards that is waiting for the player to equip or recycle it. */
  pending: LabItem | null;
  /** Run buff id -> times picked. */
  buffs: Record<string, number>;
  /** Clicks on the monitor in this run (the "Sem as Mãos" achievement wants none). */
  clicks: number;
  /** Epoch ms of the last clicks that counted, for the clicks-per-second limit. */
  clickTimes: number[];
  /** Second winds used in this phase. */
  windUsed: number;
  /** Shield of the phase (tree: phaseShield): integrity points the mobs drain before the real integrity. */
  shield: number;
  /** Times the options of the reward on screen were drawn again (tree: offerRerolls). */
  rerolled: number;
  /** Phases cleared and bosses beaten. */
  cleared: number;
  bosses: number;
  /** `t` (seconds, one decimal) at which each phase was cleared: a compact log for checking the run later. */
  clearLog: number[];
  brokenBy: LabBreakReason | null;
  /** Commits paid by the break (0 until then). */
  paid: number;
}

export interface LabTurma {
  run: LabRun | null;
  /** Items in use, by slot. They buff the clicker and give the lab its power until the next graduation. */
  equipped: Partial<Record<LabSlot, LabItem>>;
  nextUid: number;
}

/** One equipped item as a record keeps it: enough to draw the icon and its tooltip. */
export interface LabBuildItem {
  slot: LabSlot;
  base: string;
  rarity: LabRarity;
  level: number;
}

/** The equipped items at the moment of a record (at most one per slot, in slot order). */
export type LabBuild = LabBuildItem[];

/** Lifetime numbers of the lab. */
export interface LabCounters {
  runs: number;
  broken: number;
  phasesCleared: number;
  bossesBeaten: number;
  itemsFound: number;
  itemsRecycled: number;
  itemLevelUps: number;
  affixRerolls: number;
  clicks: number;
  /** Commits ever earned. */
  commitsEarned: number;
}

/**
 * What the player owns and wears of the lab's wardrobe (content/labCosmetics.ts). Permanent: it survives graduation.
 * The defaults (CRT Bege, Fósforo Verde, the Mouse quebrado) are free and never listed in `owned`.
 */
export interface LabCosmetics {
  /** Ids bought in the shop or granted (an achievement reward). */
  owned: Record<string, true>;
  monitor: string;
  theme: string;
  /** Decorations on display, in the order they were put (at most `cosmetics.decorMax`). */
  decor: string[];
  /** The item the next run starts with in the ferramenta slot (a base id; the Mouse quebrado by default). */
  startItem: string;
}

export interface LabState {
  /** Bought with diplomas, once. Permanent. */
  unlocked: boolean;
  /** The lab screen is open: the run only advances while it is. Never saved as true. */
  open: boolean;
  /** Commits in hand (permanent). */
  commits: number;
  /** Levels of the lab tree. Survives graduation. */
  tree: Record<string, number>;
  /** Version of the tree these levels were bought in (content treeVersion); an older one is refunded when read. */
  treeVersion: number;
  /** The highest phase ever reached (a run that breaks in phase 7 reached 7). Permanent. */
  bestPhase: number;
  /** The equipped items when `bestPhase` was reached (the ranking shows them). */
  bestPhaseBuild: LabBuild;
  /** The equipped items of the turma that holds `records.mostCoins` (the best run). */
  bestRunBuild: LabBuild;
  counters: LabCounters;
  /** Skins, themes, decorations and starting items. Permanent. */
  cosmetics: LabCosmetics;
  /** What lasts only until the next graduation. */
  turma: LabTurma;
}
