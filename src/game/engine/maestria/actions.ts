import type { GameContent, ProfessorId } from '../../content/types';
import type { Emit } from '../../store/types';
import { afterAction } from '../lifecycle';
import type { GameState } from '../state';
import { buyAsset as buyAssetRaw, depositFund as depositFundRaw, sellAsset as sellAssetRaw, withdrawFund as withdrawFundRaw } from './bolsa';
import { startFesta as startFestaRaw } from './festa';
import { fireRollforward as fireRollforwardRaw } from './rollforward';
import { buyMaestriaLevel as buyMaestriaLevelRaw, unlockMaestria as unlockMaestriaRaw } from './slots';
import { hitSwarmBug as hitSwarmBugRaw, startSwarm as startSwarmRaw } from './swarm';

/** Every action ends with afterAction(), like the rest of engine/actions.ts. */

export function unlockMaestria(state: GameState, content: GameContent, professor: ProfessorId, now: number, emit: Emit): boolean {
  const done = unlockMaestriaRaw(state, content, professor, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function buyMaestriaLevel(state: GameState, content: GameContent, professor: ProfessorId, now: number, emit: Emit): boolean {
  const done = buyMaestriaLevelRaw(state, content, professor, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function fireRollforward(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = fireRollforwardRaw(state, content, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function startSwarm(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = startSwarmRaw(state, content, now, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function hitBug(state: GameState, content: GameContent, uid: number, now: number, emit: Emit): boolean {
  const done = hitSwarmBugRaw(state, content, uid, now, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function startFesta(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = startFestaRaw(state, content, now, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

/** Bolsa de tokens. `fraction` is the share of the room under the limit to spend (buy) or of the holding to sell. */
export function buyBolsaAsset(state: GameState, content: GameContent, id: string, fraction: number, now: number, emit: Emit): boolean {
  const done = buyAssetRaw(state, content, id, fraction, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function sellBolsaAsset(state: GameState, content: GameContent, id: string, fraction: number, now: number, emit: Emit): boolean {
  const done = sellAssetRaw(state, content, id, fraction, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function depositBolsaFund(state: GameState, content: GameContent, fraction: number, now: number, emit: Emit): boolean {
  const done = depositFundRaw(state, content, fraction, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function withdrawBolsaFund(state: GameState, content: GameContent, fraction: number, now: number, emit: Emit): boolean {
  const done = withdrawFundRaw(state, content, fraction, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}
