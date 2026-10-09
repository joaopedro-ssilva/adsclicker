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
  | 'comboDecay' // multiplies how fast the combo falls (0 = it never does)
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
  /** Most levels bought in one single purchase. */
  | 'biggestPurchase'
  /** Longest run of consecutive calendar days with the game played. */
  | 'bestDayStreak'
  | 'playSeconds'
  | 'offlineCollections'
  /** Cafés bought for the Hackathon mode; the server credits the difference at each sync. */
  | 'cafesBought';

/** Counters of the current run only: they start again at every graduation (GameState.run). */
export type RunCounterKey = 'levelsBought';

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
  /** Seconds of play in the current sitting (the tab open and the player acting). */
  | { kind: 'session'; gte: number }
  | { kind: 'runCounter'; counter: RunCounterKey; gte: number }
  /** Sum of the levels of one professor's disciplines. */
  | { kind: 'professorLevels'; professor: ProfessorId; gte: number }
  /** Domínio rank of one professor, or of every professor when none is named. */
  | { kind: 'mastery'; rank: number; professor?: ProfessorId }
  /** Every discipline of some professor sits at exactly the same level, this one or higher. */
  | { kind: 'alignedLevels'; level: number }
  /** Every ability of the game was used at least once. */
  | { kind: 'abilitiesTried' }
  /** Every ability of the game is running at the same time. */
  | { kind: 'abilitiesActive' }
  /** Every research of the game is bought in the current run. */
  | { kind: 'everyResearch' }
  /** Every skin of that rarity is owned. */
  | { kind: 'rarityOwned'; rarity: Rarity }
  /** Different professors honoured at a graduation, ever. */
  | { kind: 'honoured'; gte: number }
  /** Graduations made on the same calendar day (the day of the last one). */
  | { kind: 'graduationsToday'; gte: number }
  /** The run closed by the last graduation: at most `lte` of the metric. Only true right after a graduation. */
  | { kind: 'lastRun'; metric: 'seconds' | 'clicks' | 'investedProfessors'; lte: number }
  /** The last run earned at least `gte` (0..1) of its coins from clicks. */
  | { kind: 'lastRunClickShare'; gte: number }
  /** The last run completed sprints and defended invasions, and failed or missed none. */
  | { kind: 'lastRunClean' }
  /** At least `unlocked` Maestrias are unlocked, each at level `level` or more (default 1). */
  | { kind: 'maestrias'; unlocked: number; level?: number }
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
// Domínio (mastery) and the honoured professor
// ---------------------------------------------------------------------------

export interface MasteryDef {
  professor: ProfessorId;
  /** Applied once per Domínio rank, like a prestige node level. The bonus reaches the whole game. */
  perRank: Effect[];
  /**
   * Line shown in the UI. `{v}` is the value of the first perRank effect at the current rank and
   * `{w}` the value of the second one. Each is formatted as the matching entry of `units`.
   */
  line: string;
  units: ('percent' | 'hours')[];
  /** What honouring the professor at a graduation adds for the following run. */
  honour: {
    /** Short label of the boost, e.g. "Combo em dobro". */
    name: string;
    description: string;
    /** Applied once, whatever the rank. */
    flat?: Effect[];
    /** Applied once per rank, on top of perRank. */
    perRank?: Effect[];
  };
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
// Monitores: students who automate a chore, hired with diplomas
// ---------------------------------------------------------------------------

export const MONITOR_IDS = ['compras', 'seguranca', 'sprints', 'pesquisa'] as const;
export type MonitorId = (typeof MONITOR_IDS)[number];

export interface MonitorLevelDef {
  /** Diplomas to reach this level (the first level hires the monitor). */
  cost: number;
  /**
   * Compras and Pesquisa: milliseconds between two purchases. Seguranca and Sprints: how long the
   * monitor lets the player act before stepping in.
   */
  delayMs: number;
  /** Seguranca only: share (0..1) of the reward of an invasion the monitor defends. */
  share?: number;
  /** What the monitor does at this level, in pt-BR, for its card. */
  line: string;
}

export interface MonitorDef {
  id: MonitorId;
  name: string;
  emoji: string;
  /** The chore it takes over, in one sentence. */
  description: string;
  /** Level 1 hires the monitor; each next one makes it faster or better. */
  levels: MonitorLevelDef[];
}

// ---------------------------------------------------------------------------
// Maestrias: one special mechanic per professor, unlocked with a graduation slot, levelled with diplomas
// ---------------------------------------------------------------------------

export const MAESTRIA_MAX_LEVEL = 5;

/** Ids of the Festa de lançamento buffs start with this, followed by the level. */
export const FESTA_BUFF_PREFIX = 'buff-festa-';

export interface MaestriaDef {
  professor: ProfessorId;
  name: string;
  /** One line for the card; also shown while the Maestria is not built yet. */
  summary: string;
  /** False = designed but not built: shown as "Em breve" and not selectable. */
  built: boolean;
  /** Diplomas for levels 2..5, in order (level 1 comes with the slot). */
  levelCosts: number[];
}

/** Numbers of the built Maestrias. Arrays are indexed by level - 1. */
export interface MaestriasConfig {
  defs: Record<ProfessorId, MaestriaDef>;
  /** Edécio, Joinha de Ouro. */
  joinha: {
    /** Manual clicks before the golden one. */
    clicksNeeded: number[];
    /** Seconds of the class's coins/second a golden click is worth. */
    seconds: number[];
    /** The golden click can crit from this level. */
    critFromLevel: number;
    /** Holding the pointer on the professor clicks by itself from this level. */
    holdFromLevel: number;
    holdPerSecond: number;
  };
  /** Gladimir, Rollforward. */
  rollforward: {
    /** Manual clicks that fill one charge. */
    clicksToFill: number;
    /** How far one charge jumps the game forward. */
    jumpSeconds: number[];
    /** Charges that can be stored. */
    maxCharges: number[];
  };
  /** Wagner, Super invasão. */
  swarm: {
    /** Real minutes for the charge to fill. */
    chargeMinutes: number[];
    durationMs: number;
    /** Regular bugs per swarm, before the boss. */
    bugs: number;
    firstSpawnMs: number;
    spawnEveryMs: number;
    /** How long a bug stays before it escapes. */
    bugLifeMs: number;
    bossAtMs: number;
    /** Clicks to defeat each kind. `sprite` is an art manifest key. */
    kinds: { id: string; name: string; sprite: string; hp: number; weight: number }[];
    boss: { id: string; name: string; sprite: string; hp: number };
    /** Seconds of the class's coins/second paid per bug and for the boss. */
    bugSeconds: number;
    bossSeconds: number;
    /** Multiplier on the reward when every bug and the boss fall. */
    clearBonus: number;
    /** Reward multiplier by level. */
    rewardMult: number[];
    /** The firewall's pace by level: one bug dies every N ms. 0 = no firewall. */
    firewallEveryMs: number[];
  };
  /** B2, Design System. */
  designSystem: {
    /** Chance, per level bought by hand, that the purchase reaches other classes. */
    chance: number[];
    /** Classes reached when it does (each gets one free level). */
    reach: number[];
    /** Most levels of one purchase that roll (bulk purchases). */
    maxRolls: number;
  };
  /** Guto, Festa de lançamento. */
  festa: {
    /** Real minutes for the button to recharge. */
    rechargeMinutes: number[];
    /** How long the party lasts. */
    seconds: number[];
    /** Multiplier on every source of coins (globalPower). */
    power: number[];
    /** Multiplier on ability recharge time (below 1 = faster). */
    cooldown: number[];
    /** Multiplier on the time between invasions (below 1 = more often). */
    invasions: number[];
    /** The party's buff by level, built from the numbers above (the save reads them by id). */
    buffs: BuffDef[];
  };
  /** B1, Releases. */
  releases: {
    /** Sprints completed in the run for each version. */
    sprintsPerVersion: number[];
    /** Production added by each version (0.03 = +3%). */
    bonus: number[];
    /** Versions per run. Never grows with the level. */
    maxVersions: number;
  };
  /** Angelo, Horas complementares. */
  horas: {
    /** Hours that fill one band. */
    hoursPerBand: number;
    /** Bands open by level; each filled band is one diploma at graduation, outside the cap. */
    bands: number[];
    /** No single activity counts for more than this share of the whole bar. */
    sourceShare: number;
    /** Hours per activity. */
    weights: { click: number; invasion: number; sprint: number; ability: number; level: number };
  };
  /** Pablo, Bolsa de tokens. */
  bolsa: {
    /** Game time between two price steps. */
    stepMs: number;
    /** Most steps a long gap catches up (the rest is skipped). */
    catchUpSteps: number;
    /** Prices kept for the sparkline. */
    historyLength: number;
    /** Most the player can have invested, in minutes of the class's production. It is also what the market pays in profit per hour. */
    limitMinutes: number[];
    /** Growth of the Fundo per minute (0.004 = 0.4%). */
    fundPerMinute: number[];
    assets: BolsaAssetDef[];
  };
}

export type BolsaTemperament = 'calm' | 'cyclic' | 'spiky';

/** One asset of the Bolsa de tokens. Prices are an index around 1, kept between `lo` and `hi`. */
export interface BolsaAssetDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  temperament: BolsaTemperament;
  /** Level of the Maestria that opens it. */
  unlockLevel: number;
  lo: number;
  hi: number;
  /** Price at the first step. */
  start: number;
  /** Pull towards the mean, per step (0..1). */
  revert: number;
  /** Size of the random wobble, in log price per step. */
  noise: number;
  /** Cyclic: swing around the mean (0.3 = ±30%) and steps per cycle. */
  amplitude?: number;
  periodSteps?: number;
  /** Spiky: chance per step of a jump and the size of it in log price. */
  spikeChance?: number;
  spikeSize?: number;
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

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  /**
   * Optional head for this skin: the professor's head drawn wearing the skin's headgear
   * ("heads/edecio-samurai"). While that file does not exist the professor's plain head is used.
   */
  head?: string;
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
  /** The art has no floor: the professor hovers on stage instead of standing (no contact shadow). */
  floats?: boolean;
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
  /**
   * Levels whose milestone multiplies by more than `milestoneMult` (level -> multiplier). Each key
   * must be a milestone level. Lets the late milestones grow so an old class catches up.
   */
  milestoneMults?: Record<number, number>;
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
  /**
   * Most manual clicks the engine accepts in any `windowMs` (a rolling window). Clicks over it are dropped without a
   * trace, so an auto-clicker gains nothing. Omitted = no limit. The server's plausibility check uses the same number.
   */
  clickLimit?: { perSecond: number; windowMs: number };
  /** Domínio: one rank per `step` levels summed over a professor's disciplines, up to `cap` ranks. */
  mastery: { step: number; cap: number };
  graduation: {
    /** Coins produced in the run that are worth the first diploma. */
    base: DecimalString;
    /** diplomas = floor((runCoins / base) ^ exponent * diplomaGain). */
    exponent: number;
    /** Additive global bonus per diploma ever earned. */
    bonusPerDiploma: number;
    /** Ceiling of the diploma bonus (additive, 3 = +300%). Omitted = no ceiling. */
    maxBonus?: number;
    /**
     * Most diplomas one graduation can pay: base x growth ^ graduations already done (10, 20, 40...
     * with 10 and 2). Coins past it count for nothing, so sitting on a run stops paying. Omitted = no cap.
     */
    cap?: { base: number; growth: number };
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
  mastery: Record<ProfessorId, MasteryDef>;
  monitors: MonitorDef[];
  maestrias: MaestriasConfig;
  balance: BalanceConfig;
}
