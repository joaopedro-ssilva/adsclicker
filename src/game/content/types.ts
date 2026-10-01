/**
 * Content contracts. Everything the game "has" is data that satisfies these types;
 * the engine only knows the types, never a specific professor or upgrade.
 *
 * Numbers that can grow without bound are written as decimal strings ("1.5e12")
 * and parsed by the engine with break_infinity.js.
 */

export type DecimalString = string;

export const PROFESSOR_IDS = [
  'edecio',
  'gladimir',
  'b2',
  'wagner',
  'guto',
  'b1',
  'angelo',
  'pablo',
] as const;
export type ProfessorId = (typeof PROFESSOR_IDS)[number];

/** A game layer that only exists once the professor who owns it is hired. */
export type Feature =
  | 'combo' // Edécio: click combo and crits
  | 'offline' // Gladimir: earnings while away
  | 'bulkBuy' // B2: x10 / max purchases
  | 'hudThemes' // B2: colour themes for the interface
  | 'events' // Wagner: invasions on the stage
  | 'abilities' // Guto: cooldown abilities
  | 'sprints' // B1: short timed goals
  | 'synergy' // Angelo: professors boost each other
  | 'graduation' // Angelo: prestige
  | 'complexity'; // Pablo: cost growth reduction

// ---------------------------------------------------------------------------
// Effects: the single way content changes the rules
// ---------------------------------------------------------------------------

export type StatKey =
  | 'globalPower' // multiplies every source of coins
  | 'clickPower' // multiplies click value
  | 'idlePower' // multiplies every discipline
  | `prof:${ProfessorId}` // multiplies the disciplines of one professor
  | `disc:${string}` // multiplies one discipline
  | 'clickFromIdle' // fraction of coins/second added to each click
  | 'critChance' // 0..1
  | 'critMult'
  | 'comboMax' // max combo steps
  | 'comboStep' // multiplier gained per combo step
  | 'autoClicks' // automatic clicks per second
  | 'offlineHours' // cap of the offline bank
  | 'offlineRate' // 0..1 fraction of production kept while away
  | 'costMult' // multiplies every discipline/click-upgrade cost (discounts are < 1)
  | 'costGrowth' // added to the per-level cost growth (negative = cheaper)
  | 'activeBonus' // multiplier for the disciplines of the professor on stage
  | 'eventInterval' // multiplies the time between invasions (lower = more often)
  | 'eventWindow' // multiplies how long an invasion stays on screen
  | 'eventReward'
  | 'abilityCooldown' // multiplies cooldowns (lower = faster)
  | 'abilityDuration'
  | 'sprintReward'
  | 'synergy' // production bonus per other hired professor
  | 'diplomaGain';

export interface Effect {
  stat: StatKey;
  /** 'add' effects are summed first, then 'mult' effects are multiplied in. */
  op: 'add' | 'mult';
  value: number;
}

// ---------------------------------------------------------------------------
// Requirements and achievement conditions
// ---------------------------------------------------------------------------

/** Lifetime counters kept in GameState.stats; achievements and sprints read them. */
export type CounterKey =
  | 'clicks'
  | 'crits'
  | 'maxCombo'
  | 'eventsDefended'
  | 'eventsMissed'
  | 'bestEventStreak'
  | 'abilitiesUsed'
  | 'sprintsCompleted'
  | 'sprintsFailed'
  | 'levelsBought'
  | 'researchBought'
  | 'graduations'
  | 'professorSwaps'
  | 'playSeconds'
  | 'offlineCollections';

export type Requirement =
  | { kind: 'professorHired'; professor: ProfessorId }
  | { kind: 'disciplineLevel'; discipline: string; level: number }
  | { kind: 'research'; research: string }
  | { kind: 'graduations'; count: number };

export type Condition =
  | { kind: 'counter'; counter: CounterKey; gte: number }
  | { kind: 'lifetimeCoins'; gte: DecimalString }
  | { kind: 'coinsPerSecond'; gte: DecimalString }
  | { kind: 'clickValue'; gte: DecimalString }
  | { kind: 'disciplineLevel'; discipline: string; level: number }
  | { kind: 'allDisciplinesLevel'; professor: ProfessorId; level: number }
  | { kind: 'professorHired'; professor: ProfessorId }
  | { kind: 'professorsHired'; gte: number }
  | { kind: 'allResearch'; professor: ProfessorId }
  | { kind: 'diplomasEarned'; gte: number }
  | { kind: 'prestigeNodes'; gte: number }
  | { kind: 'achievements'; gte: number }
  | { kind: 'skinsOwned'; gte: number; professor?: ProfessorId }
  /** Fired by name from the UI or engine (easter eggs): useGame.getState().triggerSecret(id). */
  | { kind: 'secret'; trigger: string };

// ---------------------------------------------------------------------------
// Professors and their upgrade trees
// ---------------------------------------------------------------------------

export interface ProfessorDef {
  id: ProfessorId;
  /** Display name, e.g. "Edécio". */
  name: string;
  /** What they teach, e.g. "API e Lógica de Programação". */
  subject: string;
  /** One line on the layer they bring to the game. */
  tagline: string;
  /** Accent colour (hex) that tints the HUD while this professor is on stage. */
  color: string;
  /** Hire order, 1-based. Edécio is 1 and starts hired. */
  order: number;
  hireCost: DecimalString;
  requires: Requirement[];
  features: Feature[];
  /** Short lines in the professor's voice. Kept light; polished later with the real people. */
  quotes: {
    hire: string;
    click: string[];
    idle: string[];
    milestone: string[];
  };
}

/** Levelled upgrade that produces coins per second. */
export interface DisciplineDef {
  id: string;
  professor: ProfessorId;
  /** Position inside the professor's tree (0, 1, 2). Tier n unlocks when tier n-1 reaches level 10. */
  tier: number;
  name: string;
  emoji: string;
  description: string;
  baseCost: DecimalString;
  /** Coins per second for each level, before multipliers. */
  baseProduction: DecimalString;
}

/** Levelled upgrade that raises the value of each click. */
export interface ClickUpgradeDef {
  id: string;
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  baseCost: DecimalString;
  /** Coins per click for each level, before multipliers. */
  baseClick: DecimalString;
  requires: Requirement[];
}

/** One-time purchase. */
export interface ResearchDef {
  id: string;
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  cost: DecimalString;
  effects: Effect[];
  requires: Requirement[];
  /** Unlocks an ability when bought. */
  unlocksAbility?: string;
}

// ---------------------------------------------------------------------------
// Timed systems
// ---------------------------------------------------------------------------

export interface BuffDef {
  id: string;
  name: string;
  emoji: string;
  durationMs: number;
  effects: Effect[];
}

export type Reward =
  /** Coins worth N seconds of the current idle production (with a floor so early rewards are not zero). */
  | { kind: 'coins'; seconds: number }
  | { kind: 'buff'; buff: BuffDef };

/** Guto's layer: a button with a cooldown. */
export interface AbilityDef {
  id: string;
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  cooldownMs: number;
  buff: BuffDef;
  /** Available as soon as the professor is hired, unless a research unlocks it. */
  unlockedByResearch?: string;
}

/** Wagner's layer: a threat that appears on the stage and must be clicked in time. */
export interface InvasionDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Relative chance of being picked. */
  weight: number;
  /** How long it stays on screen before it counts as missed. */
  windowMs: number;
  /** Clicks on the threat needed to defend. */
  clicksRequired: number;
  reward: Reward;
}

/** B1's layer: a short goal with a deadline. */
export type SprintGoal =
  | { kind: 'clicks'; amount: number }
  | { kind: 'crits'; amount: number }
  | { kind: 'reachCombo'; amount: number }
  | { kind: 'buyLevels'; amount: number }
  | { kind: 'defendEvents'; amount: number }
  /** Earn coins worth N seconds of the idle production measured when the sprint starts. */
  | { kind: 'earnSeconds'; amount: number };

export interface SprintDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  goal: SprintGoal;
  durationMs: number;
  reward: Reward;
  requires: Requirement[];
}

// ---------------------------------------------------------------------------
// Prestige ("Formatura")
// ---------------------------------------------------------------------------

export type PrestigeBranch = 'core' | 'click' | 'idle' | 'events';

export interface PrestigeNodeDef {
  id: string;
  branch: PrestigeBranch;
  name: string;
  emoji: string;
  description: string;
  /** Diploma cost of the first level. */
  cost: number;
  /** Cost multiplier per level already owned. 1 = flat. */
  costGrowth: number;
  maxLevel: number;
  /** Applied once per level owned. */
  effects: Effect[];
  /** Node ids that must have at least one level. */
  requires: string[];
  /** Grid position in the tree screen: column (0-based, left to right) and row (0 = root). */
  position: { col: number; row: number };
  /** Professors that stay hired after a graduation once this node is owned. */
  keepsProfessors?: ProfessorId[];
}

// ---------------------------------------------------------------------------
// Collection: achievements, skins, sceneries, HUD themes
// ---------------------------------------------------------------------------

export type AchievementFamily =
  | 'click'
  | 'production'
  | 'professor'
  | 'events'
  | 'sprints'
  | 'graduation'
  | 'collection'
  | 'secret';

export interface AchievementDef {
  id: string;
  family: AchievementFamily;
  name: string;
  emoji: string;
  /** How to earn it. Shown as "???" while a secret one is locked. */
  description: string;
  secret?: boolean;
  condition: Condition;
  /** Cosmetics granted on top of the flat production bonus every achievement gives. */
  reward?: {
    skin?: string;
    scenery?: string;
    theme?: string;
  };
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * A skin is a body sprite; the head is a separate layer that belongs to the professor.
 * Sprite files live in public/assets and are optional: when a file is missing the UI
 * draws a procedural pixel sprite from `palette`, so the game never depends on art.
 */
export interface SkinDef {
  id: string;
  professor: ProfessorId;
  name: string;
  rarity: Rarity;
  description: string;
  /** Owned from the start (one per professor). */
  default?: boolean;
  /** Asset keys relative to public/assets, without extension: "skins/edecio-samurai". */
  body: string;
  /** Optional headgear drawn over the head: "hats/edecio-samurai". */
  hat?: string;
  /** Fallback colours for the procedural sprite. */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Short prompt fragment for the art pipeline describing the outfit. */
  artPrompt: string;
}

export type Ambient = 'none' | 'dust' | 'rain' | 'embers' | 'stars' | 'bubbles' | 'code' | 'leaves' | 'confetti';

export interface SceneryDef {
  id: string;
  name: string;
  description: string;
  default?: boolean;
  /** Asset key relative to public/assets, without extension: "sceneries/datacenter". */
  asset: string;
  /** Moving particles drawn over the image. */
  ambient: Ambient;
  /** Fallback gradient (top, bottom) and floor colour when the image is missing. */
  palette: {
    sky: string;
    horizon: string;
    floor: string;
  };
  artPrompt: string;
}

/** B2's layer: colour-only skins for the interface. Values are CSS colours. */
export interface ThemeDef {
  id: string;
  name: string;
  description: string;
  default?: boolean;
  colors: {
    bg: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    text: string;
    textMuted: string;
  };
}

// ---------------------------------------------------------------------------
// Balance knobs and the aggregated content object
// ---------------------------------------------------------------------------

export interface BalanceConfig {
  /** Per-level cost growth of disciplines and click upgrades. */
  costGrowth: number;
  /** Lowest value costGrowth can be pushed to by effects. */
  minCostGrowth: number;
  /** Levels at which a discipline or click upgrade doubles its output. Past the last one, every `milestoneStep` levels. */
  milestones: number[];
  milestoneStep: number;
  milestoneMult: number;
  /** Level a tier must reach to unlock the next one. */
  tierUnlockLevel: number;
  baseClick: number;
  combo: { windowMs: number; baseMax: number; baseStep: number; decayPerSecond: number };
  crit: { baseChance: number; baseMult: number };
  activeBonus: number;
  /** Additive global bonus per achievement (0.01 = +1%). */
  achievementBonus: number;
  offline: { baseHours: number; baseRate: number; minAwayMs: number };
  events: { minIntervalMs: number; maxIntervalMs: number };
  sprints: { offers: number; cooldownMs: number };
  /** Minimum reward, in coins, for a Reward of kind 'coins' = floor * clickValue. */
  rewardClickFloor: number;
  graduation: {
    /** Coins produced in the run that are worth the first diploma. */
    base: DecimalString;
    /** diplomas = floor((runCoins / base) ^ exponent * diplomaGain). */
    exponent: number;
    /** Additive global bonus per diploma ever earned. */
    bonusPerDiploma: number;
    /** Ceiling of the diploma bonus (additive, 3 = +300%). Omitted = no ceiling. */
    maxBonus?: number;
  };
}

export interface GameContent {
  professors: Record<ProfessorId, ProfessorDef>;
  disciplines: DisciplineDef[];
  clickUpgrades: ClickUpgradeDef[];
  research: ResearchDef[];
  abilities: AbilityDef[];
  invasions: InvasionDef[];
  sprints: SprintDef[];
  prestigeNodes: PrestigeNodeDef[];
  achievements: AchievementDef[];
  skins: SkinDef[];
  sceneries: SceneryDef[];
  themes: ThemeDef[];
  balance: BalanceConfig;
}
