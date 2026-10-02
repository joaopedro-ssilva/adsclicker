import type { ProfessorId } from '@/game/content/types';
import type { MetaId, SlotId, StatId } from '@/hackathon/content';
import { SLOT_IDS } from '@/hackathon/content/types';
import { computeBuild } from '@/hackathon/engine';
import type { Build, BuildInput, ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from './hk';
import { META_ORDER, STAT_ORDER } from './labels';

export function equippedItems(profile: HackathonProfile): Partial<Record<SlotId, ItemInstance>> {
  const byId = new Map(profile.items.map((item) => [item.id, item]));
  const out: Partial<Record<SlotId, ItemInstance>> = {};
  for (const slot of SLOT_IDS) {
    const id = profile.equipped[slot];
    const item = id ? byId.get(id) : undefined;
    if (item) out[slot] = item;
  }
  return out;
}

export function buildInputOf(profile: HackathonProfile, equipped = equippedItems(profile)): BuildInput {
  const mentors: Partial<Record<ProfessorId, number>> = {};
  for (const [id, mentor] of Object.entries(profile.mentors)) mentors[id as ProfessorId] = mentor.level;
  return {
    cargo: profile.cargo,
    level: profile.level,
    skillNodes: profile.skillNodes,
    mentors,
    equipped,
    activeSkills: profile.activeSkills,
  };
}

export interface BuildDelta {
  kind: 'stat' | 'meta';
  id: StatId | MetaId;
  before: number;
  after: number;
}

function diffBuilds(before: Build, after: Build): BuildDelta[] {
  const deltas: BuildDelta[] = [];
  for (const id of STAT_ORDER) {
    if (before.stats[id] !== after.stats[id]) deltas.push({ kind: 'stat', id, before: before.stats[id], after: after.stats[id] });
  }
  for (const id of META_ORDER) {
    if (before.meta[id] !== after.meta[id]) deltas.push({ kind: 'meta', id, before: before.meta[id], after: after.meta[id] });
  }
  return deltas;
}

/** What the build would gain or lose if `item` took its slot (or if the slot were emptied, with `item` null). */
export function swapDeltas(profile: HackathonProfile, slot: SlotId, item: ItemInstance | null): BuildDelta[] {
  const current = equippedItems(profile);
  const next = { ...current };
  if (item) next[slot] = item;
  else delete next[slot];
  return diffBuilds(computeBuild(buildInputOf(profile, current), HK), computeBuild(buildInputOf(profile, next), HK));
}
