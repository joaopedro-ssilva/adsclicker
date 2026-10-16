/**
 * Content contracts of the Laboratório de Pesquisa (docs/LABORATORIO.md): a roguelike mini-game reached from the
 * classroom. It reuses the item bases, rarities, enemies and run buffs of the (disabled) Hackathon mode, and every
 * number of it lives in one file (content/lab.ts).
 */
import type {
  AffixDef,
  EnemyDef,
  ItemBaseDef,
  ItemRarity,
  ItemSetDef,
  MetaId,
  Modifier,
  RarityDef,
  SlotId,
  StatId,
  UniqueEffect,
} from '../../hackathon/content/types';
import type { ProfessorId, StatKey } from './types';

export { RARITIES as LAB_RARITIES, SLOT_IDS as LAB_SLOTS } from '../../hackathon/content/types';
export type { AffixDef as LabAffixDef, EnemyDef as LabEnemyDef, ItemRarity as LabRarity, ItemSetDef as LabSetDef, Modifier as LabModifier, RarityDef as LabRarityDef, SlotId as LabSlot, UniqueEffect as LabUniqueEffect };

/** What an item affix names: one of the Hackathon stats or metas. */
export type LabTarget = StatId | MetaId;

/**
 * Everything the lab itself reads from items, buffs, sets and the tree. Each key is a plain number that adds up
 * across sources.
 */
export const LAB_EFFECT_KEYS = [
  'damage', // + share of the automatic damage (0.2 = +20%)
  'bossDamage', // + share of the damage against bosses
  'integrityPct', // + share of the monitor's maximum integrity
  'integrityFlat', // + points of maximum integrity
  'drain', // + share of the integrity the mobs drain (negative = less)
  'repairPhase', // share of the maximum integrity restored after every phase
  'repairBoss', // share of the maximum integrity restored after every boss
  'bossTime', // + seconds on the boss timer
  'luck', // + points of loot quality (rarity)
  'extraOption', // % chance of one more reward option
  'commits', // + share of the Commits earned
  'clicker', // + share of every clicker buff of the lab
  'firstOptions', // + options at the first reward of the run
  'secondWind', // times per phase a lethal drain leaves the monitor standing
  'startSetup', // starts the run with a comum item in the Setup slot
  'startItem', // starts the run with this many random incomum items in empty slots
  'firstBossTime', // + seconds on the timer of the first boss of the run
  'offerRerolls', // times per reward the options can be drawn again
  'fastClearRepair', // share of the maximum integrity restored by a regular phase cleared within run.fastClearSeconds
  'bossOptions', // + options on the reward of a boss
  'levelKeep', // share of the level of a replaced item the new one inherits
  'phaseShield', // share of the maximum integrity every phase starts with as a shield on top
  'bossCommits', // Commits paid at once for each boss beaten
  'emptySlotDamage', // + share of damage per empty slot
  'legendaryDamage', // + share of damage per legendary equipped
  'levelCost', // + share on the ADScoins cost of item level ups (negative = cheaper)
  'recycleBonus', // + share of the Commits a recycled item pays
  'clickDamage', // + share of the damage a click on the monitor deals
] as const;
export type LabEffectKey = (typeof LAB_EFFECT_KEYS)[number];
export type LabEffects = Partial<Record<LabEffectKey, number>>;

/** A clicker stat fed by something in the lab. Always an 'add' on the stat (the sums are capped, see LabConfig.caps). */
export interface LabClickerPart {
  stat: StatKey;
  value: number;
}

/** What one unit of an affix is worth: `per` clicker value for each point (or percent), plus lab effects per unit. */
export interface LabConversion {
  clicker: { stat: StatKey; per: number }[];
  lab: LabEffects;
}

/** A fixed bonus (unique effect, run buff): clicker adds and lab effects. */
export interface LabBonus {
  clicker?: LabClickerPart[];
  lab?: LabEffects;
}

export interface LabItemBase extends ItemBaseDef {
  /** Can drop as a reward. False for the Mouse quebrado, the item every run starts with. */
  drops: boolean;
  /** First phase it can drop in. Missing = from the start (the Hackathon's 24 bases). */
  fromPhase?: number;
  /** Rolls affixes. False for the Mouse quebrado: power only, no clicker buff. */
  affixes: boolean;
  /** Small lab effects the item gives while it is equipped (the starting items of the shop; no other base has them). */
  effects?: LabEffects;
}

/** What a cosmetic of the lab changes. A monitor skin, a lab theme, a decoration or the item a run starts with. */
export type LabCosmeticKind = 'monitor' | 'theme' | 'decor' | 'start';

export interface LabCosmeticDef {
  id: string;
  kind: LabCosmeticKind;
  name: string;
  /** One line shown on the card and in the preview. */
  description: string;
  /** ADScoins (decimal string) the shop asks. Null = not sold: a default, or an achievement reward. */
  price: string | null;
  /** Free from the start (the default of its kind). */
  free?: boolean;
  /** Shown to the player while locked and not for sale. */
  hint?: string;
  /** Art key (public/assets) of a decoration or a starting item. Monitor skins and themes are CSS only. */
  art?: string;
}

/** The lab wardrobe: everything cosmetic, in one place with its prices. */
export interface LabCosmeticsConfig {
  /** Decorations that can be on display at once. */
  decorMax: number;
  /** The id equipped by default for each single-choice kind. */
  defaults: { monitor: string; theme: string; startItem: string };
  items: LabCosmeticDef[];
}

/** A run buff: a lasting upgrade picked as a reward. Its modifiers feed the clicker, `lab` feeds the run. */
export interface LabBuffDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  modifiers: Modifier[];
  lab: LabEffects;
}

export type LabBranch = 'codigo' | 'infra' | 'produto';

/** A node of the permanent lab tree, bought with Commits. */
export interface LabNodeDef {
  id: string;
  branch: LabBranch;
  name: string;
  emoji: string;
  description: string;
  /** Commits of the first level. */
  cost: number;
  /** Cost multiplier per level already owned. */
  costGrowth: number;
  maxLevel: number;
  /** Applied once per level owned. */
  effects: LabEffects;
  requires: string[];
  position: { col: number; row: number };
  /** Small clicker bonuses per level, always added before the lab caps. */
  clicker?: { stat: StatKey; per: number }[];
}

export interface LabConfig {
  unlock: {
    /** The professor whose hire opens the slot. */
    professor: ProfessorId;
    /** Diplomas spent, once. */
    diplomas: number;
  };

  bases: LabItemBase[];
  /** Id of the base every run starts with in the ferramenta slot. */
  starter: string;
  /** Monitor skins, lab themes, decorations and starting items, with their prices (labCosmetics.ts). */
  cosmetics: LabCosmeticsConfig;
  sets: ItemSetDef[];
  /** Weight, extra affixes, value multiplier and recycle Commits of each rarity (the Hackathon's). */
  rarities: RarityDef[];
  enemies: EnemyDef[];
  buffs: LabBuffDef[];
  tree: LabNodeDef[];
  /** Version of the tree's nodes and prices. A save made under an older one gets every Commit spent on the tree back. */
  treeVersion: number;
  /** The nodes of the older versions, only to price that refund: version -> node id -> prices. */
  legacyTree: Record<number, Record<string, { cost: number; costGrowth: number; maxLevel: number }>>;

  /** What each affix target is worth, by op. Targets missing here do nothing. */
  affixes: Partial<Record<LabTarget, Record<'add' | 'pct', LabConversion>>>;
  /** Legendary unique effects of kind 'skill', by skill id. */
  skillBonuses: Record<string, LabBonus>;
  /** Legendary unique of kind 'secondWind'. */
  secondWindBonus: LabBonus;
  /** Legendary unique of kind 'critSplash': worth this per point of its chance. */
  critSplash: LabConversion;
  /** Most the lab adds to a clicker stat, as a magnitude (the sign is the stat's): the same cap for every source together. */
  caps: Partial<Record<StatKey, number>>;
  /** Pt-BR names for the UI. */
  labels: {
    stats: Partial<Record<StatKey, string>>;
    effects: Record<LabEffectKey, string>;
  };

  items: {
    /** Highest item level, bought or dropped. */
    maxLevel: number;
    /** Each level above 1 adds this share of the level-1 affix values. */
    valuePerLevel: number;
    power: {
      base: number;
      /** Multiplier of the power by rarity. */
      rarity: Record<ItemRarity, number>;
      /** Power multiplier per level above 1. */
      perLevel: number;
    };
    /** Item level of a drop: 1 + floor((phase - 1) / this), plus `bossLevelBonus` from a boss. */
    dropLevelEvery: number;
    bossLevelBonus: number;
  };

  /** ADScoins: fixed numbers (decimal strings), not minutes of production. */
  costs: {
    /** Level up of a level-1 comum item. */
    levelBase: string;
    /** x per rarity step. */
    rarityStep: number;
    /** x per item level already reached. */
    levelGrowth: number;
    /** First reroll of a comum item of level 1. */
    rerollBase: string;
    /** x per rarity step. */
    rerollRarityStep: number;
    /** x per item level above 1. */
    rerollLevelGrowth: number;
    /** x per reroll already made on the same item. */
    rerollGrowth: number;
  };

  run: {
    /** Fixed simulation step, in seconds. */
    stepSeconds: number;
    /** Most real seconds one tick can feed the run (a throttled tab does not fast-forward it). */
    maxAdvanceSeconds: number;
    startIntegrity: number;
    /** Enemy HP of the Hackathon (at stage 1) x this. */
    hpScale: number;
    /** HP x this per phase. */
    hpGrowth: number;
    /** Integrity drained per second by an enemy = damage x attacks/s x this. */
    drainScale: number;
    /** Drain x this per phase. */
    drainGrowth: number;
    /** Mobs per wave: waveMin + 1 per `waveGrowEvery` phases, +0 or +1 from the seed, up to waveMax. */
    waveMin: number;
    waveMax: number;
    waveGrowEvery: number;
    /** First phase each regular enemy can appear in. */
    enemyFrom: Record<string, number>;
    /** Every Nth phase is a boss. */
    bossEvery: number;
    /** The bosses in order: the 1st boss phase fights the 1st, the 2nd the 2nd..., then the list starts over. */
    bossCycle: string[];
    /** Boss HP = its Hackathon HP x hpScale x this x the phase growth. */
    bossHpFactor: number;
    /** Boss HP x this for every boss already met in the run (the 2nd boss has this x, the 3rd this squared...). */
    bossHpGrowth: number;
    /** ...up to this many bosses; the ones after follow the plain phase growth only. */
    bossGrowthTurns: number;
    bossTimerSeconds: number;
    /** Enemy trait 'armor' (flat) becomes this share of the damage per point, up to armorMax. */
    armorPerPoint: number;
    armorMax: number;
    /** Share of the automatic damage one click deals, and the most clicks that count in `windowMs`. */
    click: { share: number; perWindow: number; windowMs: number };
    /** Share of the maximum integrity a secondWind leaves. */
    secondWindShare: number;
    /** Lowest the drain multiplier can go. */
    minDrainMult: number;
    /** Lowest the maximum integrity can go. */
    minIntegrity: number;
    /** A regular phase cleared in less than this many seconds counts as a fast clear (tree: fastClearRepair). */
    fastClearSeconds: number;
  };

  rewards: {
    /** Options per reward, before the tree and luck. */
    options: number;
    maxOptions: number;
    /** Relative chance of each kind for the options after the first (which is always an item). */
    weights: { item: number; buff: number; commits: number; repair: number };
    /** The repair weight is multiplied by this when the integrity is below half. */
    repairWhenHurt: number;
    /** Weight of a base in an empty slot, against 1 for a filled one. */
    emptySlotWeight: number;
    /** Loot quality added per phase. */
    phaseQuality: number;
    maxQuality: number;
    commitsBase: number;
    /** + this share of commitsBase per phase. */
    commitsPerPhase: number;
    repairShare: number;
    bossRepairShare: number;
    /** Boss rewards: the first item is at least this rarity, the second this one. */
    bossRarityFloor: ItemRarity;
    bossSecondFloor: ItemRarity;
    /** Boss rewards have this many items among the options. */
    bossItems: number;
  };

  commits: {
    /** Paid when the monitor breaks (or the player graduates mid-run). */
    perPhase: number;
    perBoss: number;
    /** + this share of an item's recycle value per level above 1. */
    recycleLevelBonus: number;
  };
}
