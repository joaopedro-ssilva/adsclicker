import type { LabNodeDef } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { labTotals } from './effects';
import { syncIntegrity } from './phase';
import { labIndex } from './state';

/** Commits for the next level of a node: cost x costGrowth ^ level, rounded up. */
export function labNodeCost(def: LabNodeDef, level: number): number {
  return Math.ceil(def.cost * def.costGrowth ** level - 1e-9);
}

export function labNodeLevel(state: GameState, id: string): number {
  return state.lab.tree[id] ?? 0;
}

/** Parent nodes are owned (at least one level). */
export function labNodeAvailable(state: GameState, def: LabNodeDef): boolean {
  return def.requires.every((id) => labNodeLevel(state, id) > 0);
}

/** Commits spent on the tree so far. */
export function labTreeSpent(state: GameState, content: GameContent): number {
  let spent = 0;
  for (const id in state.lab.tree) {
    const def = labIndex(content).nodes.get(id);
    if (!def) continue;
    for (let at = 0; at < Math.min(def.maxLevel, state.lab.tree[id] ?? 0); at += 1) spent += labNodeCost(def, at);
  }
  return spent;
}

export interface LabTreeResetCheck {
  ok: boolean;
  /** Commits that would come back. */
  refund: number;
  /** pt-BR reason when the reset is not possible. */
  reason: string | null;
}

/**
 * Whether the tree can be reset now, and for how many Commits. Rule: free, any time the lab is unlocked and something was
 * bought, except while a run is on (fighting, choosing a reward or deciding on an item). Resetting between phases would
 * let the player re-spend the same Commits on whatever the next phase needs, so it waits for the monitor to break (or for
 * the next graduation, when there is no run).
 */
export function labTreeResetCheck(state: GameState, content: GameContent): LabTreeResetCheck {
  const refund = labTreeSpent(state, content);
  const run = state.lab.turma.run;
  if (!state.lab.unlocked) return { ok: false, refund, reason: 'O Laboratório ainda está trancado.' };
  if (run && run.status !== 'broken') return { ok: false, refund, reason: 'Só dá para resetar a árvore fora de uma corrida.' };
  if (refund <= 0) return { ok: false, refund, reason: 'Nada foi investido na árvore.' };
  return { ok: true, refund, reason: null };
}

/** Gives every Commit spent on the tree back and empties it. Free; see labTreeResetCheck for when it is allowed. */
export function resetLabTree(state: GameState, content: GameContent, emit: Emit): boolean {
  const check = labTreeResetCheck(state, content);
  if (!check.ok) return false;
  state.lab.commits += check.refund;
  state.lab.tree = {};
  emit({ type: 'labTreeReset', refunded: check.refund });
  return true;
}

/** Buys one level of a node with Commits. Needs the lab unlocked; works with the lab closed and between turmas. */
export function buyLabNode(state: GameState, content: GameContent, id: string, emit: Emit): boolean {
  const { lab } = state;
  const def = labIndex(content).nodes.get(id);
  if (!lab.unlocked || !def) return false;
  const level = labNodeLevel(state, id);
  if (level >= def.maxLevel || !labNodeAvailable(state, def)) return false;
  const cost = labNodeCost(def, level);
  if (lab.commits < cost) return false;
  lab.commits -= cost;
  lab.tree[id] = level + 1;
  const run = lab.turma.run;
  if (run && run.status !== 'broken') syncIntegrity(run, content, labTotals(state, content));
  emit({ type: 'labNodeBought', id, level: level + 1 });
  return true;
}
