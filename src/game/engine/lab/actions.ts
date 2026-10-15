/**
 * The public actions of the Laboratório. Each mutates `state` in place and ends with afterAction(): the equipped
 * items and run buffs feed computeStats, so the cached stats must be dropped whenever they change.
 */
import type { LabSlot } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { afterAction } from '../lifecycle';
import type { GameState } from '../state';
import { unlockLab as unlockLabRaw } from './access';
import { levelUpLabItem as levelUpLabItemRaw, rerollLabAffix as rerollLabAffixRaw } from './bench';
import { chooseLabReward as chooseLabRewardRaw, resolveLabPending as resolveLabPendingRaw } from './rewards';
import { labClick as labClickRaw, setLabOpen as setLabOpenRaw, startLabRun as startLabRunRaw } from './run';
import { buyLabNode as buyLabNodeRaw } from './tree';

export function unlockLab(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = unlockLabRaw(state, content, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

/** Opens or closes the lab screen. The run advances only while it is open. */
export function setLabOpen(state: GameState, open: boolean): void {
  setLabOpenRaw(state, open);
}

/** Starts the run of the turma. `seed` is a 32-bit integer: every roll of the run comes from it. */
export function startLabRun(state: GameState, content: GameContent, seed: number, now: number, emit: Emit): boolean {
  const done = startLabRunRaw(state, content, seed, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

/** A click on the monitor. False when it did not count. */
export function labClick(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  return labClickRaw(state, content, now, emit);
}

/** Picks one of the options after a phase. */
export function chooseLabReward(state: GameState, content: GameContent, index: number, now: number, emit: Emit): boolean {
  const done = chooseLabRewardRaw(state, content, index, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

/** The item waiting for a decision takes its slot (the one in it is recycled). */
export function equipLabPending(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = resolveLabPendingRaw(state, content, true, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

/** The item waiting for a decision is recycled into Commits. */
export function recycleLabPending(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = resolveLabPendingRaw(state, content, false, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function levelUpLabItem(state: GameState, content: GameContent, slot: LabSlot, now: number, emit: Emit): boolean {
  const done = levelUpLabItemRaw(state, content, slot, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function rerollLabAffix(state: GameState, content: GameContent, slot: LabSlot, affix: number, now: number, emit: Emit): boolean {
  const done = rerollLabAffixRaw(state, content, slot, affix, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function buyLabNode(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const done = buyLabNodeRaw(state, content, id, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}
