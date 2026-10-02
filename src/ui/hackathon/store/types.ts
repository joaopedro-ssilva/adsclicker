import type { ProfessorId } from '@/game/content/types';
import type { SlotId } from '@/hackathon/content/types';
import type { Build, FightEvent, ResolvedStage, RunState } from '@/hackathon/engine/types';
import type { HackathonProfile, RunFinishResponse } from '@/shared/hackathonApi';

/**
 * Client state of the Hackathon mode. The profile is whatever the server last answered:
 * nothing here is saved locally and the screens never compute rewards themselves.
 */
export type HackathonStatus =
  | 'idle' // never loaded
  | 'loading'
  | 'offline' // server unreachable or not configured: the mode is unavailable
  | 'locked' // the classroom has not reached the unlock yet (lockReason says why)
  | 'creating' // unlocked, but the student was not created yet
  | 'ready';

/** A fight in progress. `state` is replaced on every tick. */
export interface ActiveRun {
  runId: string;
  stage: ResolvedStage;
  build: Build;
  auto: boolean;
  state: RunState;
  /** Flow bar filled by clicks, 0 to 1. At 1 it fires as soon as the engine allows it. */
  flowCharge: number;
  /** True from the end of the fight until the server answers with the rewards. */
  finishing: boolean;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export interface HackathonState {
  /** Which screen the game shows. Switching to 'hackathon' loads the profile. */
  mode: 'classroom' | 'hackathon';
  status: HackathonStatus;
  lockReason: string | null;
  profile: HackathonProfile | null;
  run: ActiveRun | null;
  /** The server's answer for the last finished run, kept until dismissed (the rewards screen). */
  lastResult: RunFinishResponse | null;
  /** A request is in flight: buttons should be disabled. */
  pending: boolean;
}

export interface HackathonActions {
  setMode(mode: 'classroom' | 'hackathon'): void;
  /** Fetches the profile (also called by setMode). Safe to call again. */
  load(): Promise<void>;
  createStudent(head: string): Promise<ActionResult>;

  /** Spends one Café, gets the seed from the server and starts the fight loop. */
  startRun(stageId: string, auto: boolean): Promise<ActionResult>;
  /** A click on the arena: adds to the Flow bar. */
  flowClick(): void;
  /** Uses an active skill now (ignored in auto mode or on cooldown). */
  useSkill(skill: string): void;
  /** Picks one of the three upgrades offered between waves. */
  choose(option: 0 | 1 | 2): void;
  /** Leaves the fight; it counts as a defeat. */
  abandonRun(): void;
  dismissResult(): void;

  equip(slot: SlotId, itemId: string | null): Promise<ActionResult>;
  buyNode(node: string): Promise<ActionResult>;
  respec(): Promise<ActionResult>;
  setActiveSkills(skills: string[]): Promise<ActionResult>;
  buyMentor(professor: ProfessorId): Promise<ActionResult>;
  recycle(itemIds: string[]): Promise<ActionResult>;
  reroll(itemId: string, affixIndex: number): Promise<ActionResult>;
  /** Buys one Café in the classroom with ADScoins and syncs, so the server credits it. */
  buyCafe(): Promise<ActionResult>;
}

export type HackathonStore = HackathonState & HackathonActions;

/** What the arena listens to for animation and sound: the events of each tick, in order. */
export type FightEventListener = (events: FightEvent[], state: RunState) => void;
