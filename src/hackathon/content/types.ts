/**
 * Content contracts of the Hackathon mode. Everything the mode "has" is data in these shapes;
 * the engine only knows the types. See docs/HACKATHON.md.
 */
import type { ProfessorId } from '@/game/content/types';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const STAT_IDS = ['logica', 'agilidade', 'foco', 'resiliencia', 'atencao', 'sorte'] as const;
/**
 * logica: damage per hit · agilidade: hits per second x100 (120 = 1.2 hits/s) · foco: max HP ·
 * resiliencia: damage taken x 100 / (100 + resiliencia) · atencao: crit chance in % (crits hit x2) ·
 * sorte: loot quality and extra drops (never used inside a fight).
 */
export type StatId = (typeof STAT_IDS)[number];
export type Stats = Record<StatId, number>;

/** Things outside the six stats that items, skills and mentors can also change. */
export type MetaId =
  | 'dropExtra' // chance in % of one more item per victory
  | 'lootQuality' // shifts rarity weights upwards, in %
  | 'commitsGain' // % more Commits per stage
  | 'xpGain' // % more XP per stage
  | 'setBonus' // % stronger set bonuses
  | 'bossDamage' // % more damage against bosses
  | 'skillPower' // % stronger active skills
  | 'cooldown'; // % shorter skill cooldowns

export interface Modifier {
  target: StatId | MetaId;
  /** 'add' values are summed first; 'pct' adds a percentage of the summed value. */
  op: 'add' | 'pct';
  value: number;
}

// ---------------------------------------------------------------------------
// Player progression
// ---------------------------------------------------------------------------

export type CargoId = 'estudante' | 'estagiario';

export interface CargoDef {
  id: CargoId;
  name: string;
  order: number;
  /** Highest level reachable while in this cargo. */
  maxLevel: number;
  /** How many active skills can be equipped. */
  skillSlots: number;
  /** Multiplier applied to ADScoins in the classroom. */
  classroomMultiplier: number;
  /** Stage whose first victory promotes to the next cargo, or null for the last cargo of this version. */
  promotionStage: string | null;
  /** Body sprite, relative to public/assets without extension: "hackathon/bodies/estudante". */
  body: string;
}

export interface HeadDef {
  id: string;
  name: string;
  /** "hackathon/heads/<id>". */
  asset: string;
}

/** A node of the skill tree. Passive nodes carry modifiers; active nodes unlock a skill. */
export interface SkillNodeDef {
  id: string;
  branch: 'codigo' | 'infra' | 'produto';
  name: string;
  emoji: string;
  description: string;
  /** Skill points to buy one level. */
  cost: number;
  maxLevel: number;
  /** Applied once per level owned. */
  modifiers: Modifier[];
  /** Active skill unlocked by owning at least one level. */
  unlocksSkill?: string;
  requires: string[];
  position: { col: number; row: number };
}

export type SkillEffect =
  | { kind: 'heal'; percentOfMaxHp: number }
  /** Damage to every enemy alive, as a multiple of the player's hit. */
  | { kind: 'aoe'; hitMultiplier: number }
  /** The next hit taken is negated. Lasts until used or until `durationMs` passes. */
  | { kind: 'block'; durationMs: number }
  | { kind: 'haste'; attackSpeedMultiplier: number; durationMs: number }
  /** A single heavy hit on the current target. */
  | { kind: 'strike'; hitMultiplier: number };

export interface ActiveSkillDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cooldownMs: number;
  effect: SkillEffect;
}

export interface MentorDef {
  professor: ProfessorId;
  /** One line on what this mentor teaches the student. */
  teaches: string;
  /** Applied once per mentor level. */
  modifiers: Modifier[];
  /** Commits to buy level 1, 2, ... (length = max level). */
  costs: number[];
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const SLOT_IDS = ['ferramenta', 'setup', 'acessorio', 'amuleto'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export const RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario'] as const;
export type ItemRarity = (typeof RARITIES)[number];

/** One line an item can roll. The value is drawn between min and max at item level 1 and grows with the level. */
export interface AffixDef {
  target: StatId | MetaId;
  op: 'add' | 'pct';
  min: number;
  max: number;
}

/** The legendary version of a base carries this on top of its rolled affixes. */
export type UniqueEffect =
  | { kind: 'modifiers'; description: string; modifiers: Modifier[] }
  | { kind: 'skill'; description: string; skill: string }
  /** Once per stage, a killing blow leaves the player at 1 HP instead. */
  | { kind: 'secondWind'; description: string }
  /** Each crit has this chance (in %) of also hitting every other enemy. */
  | { kind: 'critSplash'; description: string; chance: number };

export interface ItemBaseDef {
  id: string;
  slot: SlotId;
  name: string;
  emoji: string;
  description: string;
  /** The affix every copy of this item has. */
  primary: AffixDef;
  /** The pool the remaining affixes are drawn from (no repeats on one item). */
  pool: AffixDef[];
  unique: UniqueEffect;
  /** Set this base belongs to, if any. */
  set?: string;
  /** "hackathon/items/<id>". */
  asset: string;
}

export interface ItemSetDef {
  id: string;
  name: string;
  /** Bonus at 2 and at 4 pieces equipped. */
  bonuses: { pieces: 2 | 4; description: string; modifiers: Modifier[] }[];
}

export interface RarityDef {
  id: ItemRarity;
  name: string;
  /** Relative chance before luck. */
  weight: number;
  /** Rolled affixes besides the primary. */
  extraAffixes: number;
  /** Multiplies every rolled value. */
  valueMultiplier: number;
  /** Commits given back when recycled. */
  recycleCommits: number;
}

// ---------------------------------------------------------------------------
// Enemies and stages
// ---------------------------------------------------------------------------

export type EnemyTrait =
  /** Every `everyAttacks` attacks, the player's next hit is skipped. */
  | { kind: 'stun'; everyAttacks: number }
  /** Damage grows by this % of its base every second of the wave. */
  | { kind: 'ramp'; percentPerSecond: number }
  /** Flat reduction of each hit taken (never below 1). */
  | { kind: 'armor'; flat: number }
  /** On death, `count` enemies of `into` join the wave. */
  | { kind: 'split'; into: string; count: number }
  /** The wave is lost if it lasts longer than this. */
  | { kind: 'timer'; seconds: number }
  /** Every `everySeconds`, charges for `windupMs` and then hits for `hitMultiplier` x its damage. */
  | { kind: 'charge'; everySeconds: number; windupMs: number; hitMultiplier: number };

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  boss: boolean;
  /** At stage level 1; scaled by StageDef.level through HackathonConfig.enemyScaling. */
  hp: number;
  damage: number;
  /** Attacks per second x100. */
  attackSpeed: number;
  traits: EnemyTrait[];
  /** "hackathon/enemies/<id>". */
  asset: string;
}

/** A temporary upgrade offered between waves; it lasts until the stage ends. */
export interface WaveBuffDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  modifiers: Modifier[];
  /** Applied immediately when picked. */
  heal?: { percentOfMaxHp: number };
}

export interface StageDef {
  id: string;
  chapter: number;
  /** Order inside the chapter, 1-based. The boss is last. */
  order: number;
  name: string;
  description: string;
  /** Scales enemies, item values and rewards. */
  level: number;
  /** Player level needed to enter. */
  requiredLevel: number;
  /** Stage that must have been won before this one opens, or null. */
  requires: string | null;
  boss: boolean;
  /** Each wave is a list of enemy ids. The last wave always stays last; the others are shuffled by the seed. */
  waves: string[][];
  /** Item bases this stage can drop (3 to 4). */
  drops: string[];
  xp: number;
  commits: number;
  /** "hackathon/arenas/<id>". */
  arena: string;
}

/** A rule of the day for the daily stage. */
export interface DailyModifierDef {
  id: string;
  name: string;
  description: string;
  enemyHpPercent?: number;
  enemyDamagePercent?: number;
  /** Rarity weights shift up by this %. */
  lootQuality?: number;
  xpPercent?: number;
  /** Healing is disabled for the whole stage. */
  noHealing?: boolean;
}

// ---------------------------------------------------------------------------
// Tuning knobs and the aggregated content object
// ---------------------------------------------------------------------------

export interface HackathonConfig {
  /** Base stats of a level 1 student, and what each level adds. */
  baseStats: Stats;
  statsPerLevel: Partial<Stats>;
  /** XP needed to go from level n to n+1 = xpBase + xpStep * (n - 1), rounded. */
  xpBase: number;
  xpStep: number;
  /** Share of the XP kept on a defeat. */
  defeatXpShare: number;
  /** Per stage level above 1: enemies get this % more HP and damage. */
  enemyScaling: { hpPercentPerLevel: number; damagePercentPerLevel: number };
  /** Per stage level above 1: rolled item values grow by this %. */
  itemValuePercentPerLevel: number;
  flow: { minIntervalMs: number };
  autoSkillPower: number;
  critMultiplier: number;
  /** The classroom price of a Café lives in src/game/engine/cafe.ts. */
  cafe: { max: number; regenMinutes: number; boughtPerDayCap: number };
  graduation: { xp: number; perDayCap: number };
  inventorySize: number;
  pityVictories: number;
  /** Percent chance of an extra item per victory, before modifiers. */
  baseDropExtra: number;
  bossDrops: number;
  firstClear: { minRarity: ItemRarity; commitsMultiplier: number };
  reroll: { baseCommits: number };
  respecCommits: number;
  /** Each mentor level adds this to the professor's classroom production (0.1 = +10%). */
  mentorClassroomBonus: number;
  /** Minimum time a run may take, as a share of its simulated duration (blocks instant farming). */
  minRunTimeShare: number;
  daily: { waves: number; modifiers: number };
  runExpiryMinutes: number;
}

export interface HackathonContent {
  cargos: CargoDef[];
  heads: HeadDef[];
  skillNodes: SkillNodeDef[];
  skills: ActiveSkillDef[];
  mentors: MentorDef[];
  items: ItemBaseDef[];
  sets: ItemSetDef[];
  rarities: RarityDef[];
  enemies: EnemyDef[];
  waveBuffs: WaveBuffDef[];
  stages: StageDef[];
  dailyModifiers: DailyModifierDef[];
  config: HackathonConfig;
}
