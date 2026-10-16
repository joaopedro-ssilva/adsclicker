/**
 * The public actions of the engine. Each mutates `state` in place and reports what happened
 * through `emit`. Time comes in as `now` (epoch ms) and randomness as `rng`; nothing here reads
 * a clock. Every action ends with afterAction(): settle the sprint and scan achievements.
 */
import type { GameContent, MonitorId, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { activateAbility as activateAbilityRaw } from './buffs';
import { getIndex } from './contentIndex';
import { afterAction } from './lifecycle';
import { buyMonitor as buyMonitorRaw } from './monitors';
import {
  buyPrestigeNode as buyPrestigeNodeRaw,
  graduate as graduateRaw,
  resetPrestigeTree as resetPrestigeTreeRaw,
} from './prestige';
import { buyLevelled } from './purchases';
import { hitInvasion as hitInvasionRaw } from './invasions';
import { acceptSprint as acceptSprintRaw } from './sprints';
import type { GameState } from './state';

export { favouriteKey, toggleFavourite } from './favourites';
export type { FavouriteKind } from './favourites';
export { click } from './click';
export type { ClickPosition } from './click';
export {
  buyResearch,
  equipScenery,
  equipSkin,
  equipTheme,
  hireProfessor,
  setActiveProfessor,
  setBuyAmount,
} from './purchases';

/** `rng` only matters to B2's Design System; without it that Maestria never rolls. */
export function buyDiscipline(
  state: GameState,
  content: GameContent,
  id: string,
  now: number,
  emit: Emit,
  rng?: () => number,
): boolean {
  if (getIndex(content).levelled.get(id)?.kind !== 'discipline') return false;
  return buyLevelled(state, content, id, now, emit, rng);
}

export function buyClickUpgrade(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  if (getIndex(content).levelled.get(id)?.kind !== 'clickUpgrade') return false;
  return buyLevelled(state, content, id, now, emit);
}

/** One click on the invasion on stage. */
export function hitInvasion(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): boolean {
  const hit = hitInvasionRaw(state, content, now, rng, emit);
  if (hit) afterAction(state, content, now, emit);
  return hit;
}

/** Named activateAbility, not useAbility, so linters do not take it for a React hook. */
export function activateAbility(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const used = activateAbilityRaw(state, content, id, now, emit);
  if (used) afterAction(state, content, now, emit);
  return used;
}

export function acceptSprint(state: GameState, content: GameContent, defId: string, now: number, emit: Emit): boolean {
  const accepted = acceptSprintRaw(state, content, defId, now, emit);
  if (accepted) afterAction(state, content, now, emit);
  return accepted;
}

/** `honour`: the hired professor honoured for the next run, or null for none. */
export function graduate(
  state: GameState,
  content: GameContent,
  now: number,
  emit: Emit,
  honour: ProfessorId | null = null,
): boolean {
  const done = graduateRaw(state, content, emit, now, honour);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function buyPrestigeNode(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const bought = buyPrestigeNodeRaw(state, content, id, emit);
  if (bought) afterAction(state, content, now, emit);
  return bought;
}

export function resetPrestigeTree(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = resetPrestigeTreeRaw(state, content, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function buyMonitor(state: GameState, content: GameContent, id: MonitorId, now: number, emit: Emit): boolean {
  const bought = buyMonitorRaw(state, content, id, emit);
  if (bought) afterAction(state, content, now, emit);
  return bought;
}

export { setMonitorOn, setMonitorSettings } from './monitors';

export {
  buyBolsaAsset,
  buyMaestriaLevel,
  depositBolsaFund,
  fireRollforward,
  hitBug,
  setMaestriaEnabled,
  sellBolsaAsset,
  startFesta,
  startSwarm,
  unlockMaestria,
  withdrawBolsaFund,
} from './maestria/actions';

export { buyCafe, cafeCost } from './cafe';

export {
  buyLabNode,
  chooseLabReward,
  equipLabPending,
  labClick,
  levelUpLabItem,
  recycleLabPending,
  rerollLabAffix,
  setLabOpen,
  startLabRun,
  unlockLab,
} from './lab/actions';

/** Easter eggs: remembers the trigger so achievements with { kind: 'secret', trigger } unlock. */
export function triggerSecret(state: GameState, content: GameContent, trigger: string, now: number, emit: Emit): void {
  if (state.secrets[trigger]) return;
  state.secrets[trigger] = true;
  afterAction(state, content, now, emit);
}
