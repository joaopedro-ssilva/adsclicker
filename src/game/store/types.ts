import type Decimal from 'break_infinity.js';
import type { ProfessorId, Rarity } from '../content/types';
import type { BuyAmount, GameState, Settings } from '../engine/state';

// ---------------------------------------------------------------------------
// Event bus: things that happened, for animation, sound and toasts.
// The engine emits; the UI subscribes with useGameEvents(). Never used for state.
// ---------------------------------------------------------------------------

export type RewardResult =
  | { kind: 'coins'; amount: Decimal }
  | { kind: 'buff'; buffId: string; name: string; emoji: string; durationMs: number };

export type GameEvent =
  | { type: 'click'; value: Decimal; crit: boolean; comboSteps: number; auto: boolean; x?: number; y?: number }
  | { type: 'purchase'; kind: 'discipline' | 'clickUpgrade' | 'research' | 'prestigeNode'; id: string; levels: number }
  | { type: 'milestone'; id: string; level: number }
  | { type: 'hire'; professor: ProfessorId }
  | { type: 'achievement'; id: string }
  | { type: 'unlock'; kind: 'skin' | 'scenery' | 'theme'; id: string; rarity?: Rarity }
  | { type: 'invasionSpawn'; uid: number; def: string }
  | { type: 'invasionHit'; uid: number; clicksLeft: number }
  | { type: 'invasionDefended'; uid: number; def: string; reward: RewardResult; streak: number }
  | { type: 'invasionMissed'; uid: number; def: string }
  | { type: 'abilityUsed'; id: string }
  | { type: 'buffStart'; id: string }
  | { type: 'buffEnd'; id: string }
  | { type: 'sprintOffers' }
  | { type: 'sprintStart'; def: string }
  | { type: 'sprintDone'; def: string; reward: RewardResult }
  | { type: 'sprintFailed'; def: string }
  | { type: 'graduate'; diplomas: number }
  | { type: 'offline'; coins: Decimal; awayMs: number }
  | { type: 'saved' }
  | { type: 'loaded' }
  | { type: 'reset' };

export type GameEventType = GameEvent['type'];
export type Emit = (event: GameEvent) => void;

// ---------------------------------------------------------------------------
// View models: what the UI reads. Built by pure functions in engine/views.ts.
// ---------------------------------------------------------------------------

export interface LevelledView {
  id: string;
  kind: 'discipline' | 'clickUpgrade';
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  level: number;
  unlocked: boolean;
  /** Why it is locked, ready to show: "Requer Café Quentinho no nível 10". */
  lockReason: string | null;
  /** How many levels the current buy amount would purchase (at least 1, even when unaffordable). */
  buyCount: number;
  /** Cost of those `buyCount` levels. */
  cost: Decimal;
  affordable: boolean;
  /** Current total output: coins/second for a discipline, coins/click for a click upgrade. */
  output: Decimal;
  /** Output gained by buying `buyCount` levels. */
  outputGain: Decimal;
  /** Next level that doubles the output, or null. */
  nextMilestone: number | null;
  /** 0..1 progress from the previous milestone to the next. */
  milestoneProgress: number;
  /** Share of the total coins/second (disciplines only), 0..1. */
  share: number;
}

export interface ResearchView {
  id: string;
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  cost: Decimal;
  bought: boolean;
  /** Requirements met, so it shows up in the list. */
  visible: boolean;
  affordable: boolean;
}

export interface ProfessorView {
  id: ProfessorId;
  name: string;
  subject: string;
  tagline: string;
  color: string;
  order: number;
  hired: boolean;
  active: boolean;
  hireCost: Decimal;
  /** Requirements other than cost are met. */
  canBeHired: boolean;
  affordable: boolean;
  lockReason: string | null;
  /** Coins/second from this professor's disciplines. */
  production: Decimal;
  equippedSkin: string;
}

export interface AbilityView {
  id: string;
  professor: ProfessorId;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  /** 0 when ready. */
  cooldownLeftMs: number;
  cooldownMs: number;
  /** Buff time left when the ability is running, else 0. */
  activeLeftMs: number;
}

export interface PrestigeNodeView {
  id: string;
  level: number;
  maxLevel: number;
  /** Cost of the next level in diplomas. */
  cost: number;
  affordable: boolean;
  /** Parent nodes are owned. */
  available: boolean;
  maxed: boolean;
}

export interface GraduationPreview {
  /** Feature unlocked (Angelo hired). */
  unlocked: boolean;
  /** Diplomas a graduation would give right now. */
  diplomas: number;
  /** Run coins needed for the next diploma. */
  nextAt: Decimal;
  /** 0..1 progress towards the next diploma. */
  progress: number;
  canGraduate: boolean;
}

export interface AchievementView {
  id: string;
  unlocked: boolean;
  unlockedAt: number | null;
  /** 0..1, when the condition is measurable. */
  progress: number | null;
}

export interface OfflineReport {
  coins: Decimal;
  awayMs: number;
  /** Away time that actually counted, after the cap. */
  countedMs: number;
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export interface GameActions {
  /** Loads the save (or starts fresh), applies offline earnings and starts the loop. Safe to call twice. */
  boot(): void;
  /** Stops the loop and saves. */
  shutdown(): void;

  /** A click on the professor. x/y are viewport pixels, used only for effects. */
  click(x?: number, y?: number): void;

  setBuyAmount(amount: BuyAmount): void;
  buyDiscipline(id: string): boolean;
  buyClickUpgrade(id: string): boolean;
  buyResearch(id: string): boolean;
  hireProfessor(id: ProfessorId): boolean;
  setActiveProfessor(id: ProfessorId): void;

  equipSkin(id: string): void;
  equipScenery(id: string): void;
  equipTheme(id: string): void;

  /** A click on the invasion currently on stage. */
  hitInvasion(): void;
  useAbility(id: string): boolean;
  acceptSprint(defId: string): boolean;

  graduate(): boolean;
  buyPrestigeNode(id: string): boolean;

  /** Easter eggs: unlocks achievements whose condition is { kind: 'secret', trigger }. */
  triggerSecret(trigger: string): void;

  updateSettings(patch: Partial<Settings>): void;
  save(): void;
  /** The raw save JSON (what the cloud stores). Accepted back by importSave. */
  serialize(): string;
  /** A string the player can copy or download. */
  exportSave(): string;
  /** Returns false when the string is not a valid save. */
  importSave(data: string): boolean;
  hardReset(): void;

  /** Offline earnings of the last boot, until dismissed. */
  dismissOffline(): void;
}

export interface GameStore extends GameActions {
  state: GameState;
  /** True after boot() finished. Render nothing game-related before that (avoids hydration mismatch). */
  ready: boolean;
  offlineReport: OfflineReport | null;
}
