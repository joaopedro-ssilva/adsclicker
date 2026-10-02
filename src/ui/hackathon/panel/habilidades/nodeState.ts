import { nodeLock } from '@/hackathon/engine';
import type { SkillNodeDef } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';

export type NodeState = 'maxed' | 'ready' | 'owned' | 'available' | 'locked';

export interface NodeView {
  node: SkillNodeDef;
  level: number;
  state: NodeState;
  /** Why it cannot be bought now (from the engine), or null when it can. */
  lock: string | null;
}

/** What the tile shows: maxed, buyable now, owned, waiting for points, or behind a requirement. */
export function nodeView(node: SkillNodeDef, profile: HackathonProfile): NodeView {
  const level = profile.skillNodes[node.id] ?? 0;
  const lock = nodeLock(node.id, profile.level, profile.skillNodes, HK);
  const requirementsMet = node.requires.every((id) => (profile.skillNodes[id] ?? 0) >= 1);
  let state: NodeState;
  if (level >= node.maxLevel) state = 'maxed';
  else if (!requirementsMet) state = 'locked';
  else if (lock === null) state = 'ready';
  else state = level > 0 ? 'owned' : 'available';
  return { node, level, state, lock };
}
