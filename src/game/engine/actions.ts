/**
 * The public actions of the engine. Each mutates `state` in place and reports what happened
 * through `emit`. Time comes in as `now` (epoch ms) and randomness as `rng`; nothing here reads
 * a clock. Every action ends with afterAction(): settle the sprint and scan achievements.
 */
import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { activateAbility as activateAbilityRaw } from './buffs';
import { getIndex } from './contentIndex';
import { afterAction } from './lifecycle';
import { buyPrestigeNode as buyPrestigeNodeRaw, graduate as graduateRaw } from './prestige';
import { buyLevelled } from './purchases';
import { hitInvasion as hitInvasionRaw } from './invasions';
import { acceptSprint as acceptSprintRaw } from './sprints';
import type { GameState } from './state';

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

export function buyDiscipline(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  if (getIndex(content).levelled.get(id)?.kind !== 'discipline') return false;
  return buyLevelled(state, content, id, now, emit);
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

export function graduate(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const done = graduateRaw(state, content, emit);
  if (done) afterAction(state, content, now, emit);
  return done;
}

export function buyPrestigeNode(state: GameState, content: GameContent, id: string, now: number, emit: Emit): boolean {
  const bought = buyPrestigeNodeRaw(state, content, id, emit);
  if (bought) afterAction(state, content, now, emit);
  return bought;
}

/** Easter eggs: remembers the trigger so achievements with { kind: 'secret', trigger } unlock. */
export function triggerSecret(state: GameState, content: GameContent, trigger: string, now: number, emit: Emit): void {
  if (state.secrets[trigger]) return;
  state.secrets[trigger] = true;
  afterAction(state, content, now, emit);
}
