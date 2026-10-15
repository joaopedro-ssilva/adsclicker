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
