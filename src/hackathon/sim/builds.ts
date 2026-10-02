import type { CargoId, HackathonContent, ItemRarity, SkillNodeDef, SlotId } from '../content/types';
import { SLOT_IDS } from '../content/types';
import { computeBuild } from '../engine/build';
import { indexOf } from '../engine/contentIndex';
import { rollItem } from '../engine/loot';
import { freeSkillPoints, nodeLock } from '../engine/progression';
import type { Build, BuildInput, ItemInstance } from '../engine/types';

/** The cargo a student of this level has (the first one whose cap reaches it). */
export function cargoForLevel(level: number, content: HackathonContent): CargoId {
  const cargos = [...content.cargos].sort((a, b) => a.order - b.order);
  return (cargos.find((c) => level <= c.maxLevel) ?? cargos[cargos.length - 1])?.id ?? 'estudante';
}

/** The node to buy next on the way to `target`: its first missing prerequisite, or the node itself. */
function nextStep(target: SkillNodeDef, owned: Record<string, number>, content: HackathonContent): SkillNodeDef {
  for (const id of target.requires) {
    const required = indexOf(content).nodes.get(id);
    if (required && (owned[id] ?? 0) < 1) return nextStep(required, owned, content);
  }
  return target;
}

/**
 * Spends every skill point: first on the wanted active skills (default: all, in tree order, until
 * the slots are full), buying their prerequisites on the way and saving points when a step is too
 * dear; then on the passive node with the fewest levels, so the rest spreads across the tree.
 */
export function allocateSkills(
  level: number,
  cargo: CargoId,
  content: HackathonContent,
  wanted?: string[],
): { skillNodes: Record<string, number>; activeSkills: string[] } {
  const slots = indexOf(content).cargos.get(cargo)?.skillSlots ?? 0;
  const goals = (wanted ?? content.skills.map((s) => s.id)).slice(0, slots);
  const skillNodes: Record<string, number> = {};
  const activeSkills: string[] = [];
  for (let guard = 0; guard < 500; guard += 1) {
    const free = freeSkillPoints(level, skillNodes, content);
    if (free <= 0) break;
    const goal = goals.find((id) => !activeSkills.includes(id));
    const goalNode = goal ? content.skillNodes.find((n) => n.unlocksSkill === goal) : undefined;
    let pick: SkillNodeDef | undefined;
    if (goalNode) {
      const step = nextStep(goalNode, skillNodes, content);
      if (step.cost > free) break;
      pick = step;
    } else {
      pick = content.skillNodes
        .filter((n) => !n.unlocksSkill && nodeLock(n.id, level, skillNodes, content) === null)
        .sort((x, y) => (skillNodes[x.id] ?? 0) - (skillNodes[y.id] ?? 0))[0];
    }
    if (!pick || nodeLock(pick.id, level, skillNodes, content) !== null) break;
    skillNodes[pick.id] = (skillNodes[pick.id] ?? 0) + 1;
    if (pick.unlocksSkill && !activeSkills.includes(pick.unlocksSkill)) activeSkills.push(pick.unlocksSkill);
  }
  return { skillNodes, activeSkills };
}

/** A typical item of that rarity: every random draw lands in the middle (rng fixed at 0.5). */
export function typicalItem(baseId: string, rarity: ItemRarity, level: number, content: HackathonContent): ItemInstance | null {
  const index = indexOf(content);
  const base = index.items.get(baseId);
  const rarityDef = index.rarities.get(rarity);
  if (!base || !rarityDef) return null;
  return rollItem(base, rarityDef, level, { rng: () => 0.5, now: 0, newId: () => `typical-${baseId}` }, content);
}

export interface StudentSpec {
  level: number;
  /** Rarity of the item in every slot, or null for a student with no items. */
  gear: ItemRarity | null;
  /** Mentor levels to give every mentor (0 = none). */
  mentorLevel?: number;
  /** Item level; defaults to the student's level. */
  itemLevel?: number;
  /** Active skills to unlock, in order of priority (default: the tree order). */
  skills?: string[];
}

/** A student with spent skill points and, optionally, one typical item per slot. */
export function buildStudent(spec: StudentSpec, content: HackathonContent): Build {
  const cargo = cargoForLevel(spec.level, content);
  const { skillNodes, activeSkills } = allocateSkills(spec.level, cargo, content, spec.skills);
  const equipped: Partial<Record<SlotId, ItemInstance>> = {};
  if (spec.gear) {
    for (const slot of SLOT_IDS) {
      const base = content.items.find((b) => b.slot === slot && !b.set) ?? content.items.find((b) => b.slot === slot);
      const item = base ? typicalItem(base.id, spec.gear, spec.itemLevel ?? spec.level, content) : null;
      if (item) equipped[slot] = item;
    }
  }
  const mentors: BuildInput['mentors'] = {};
  for (const mentor of content.mentors) mentors[mentor.professor] = Math.min(spec.mentorLevel ?? 0, mentor.costs.length);
  return computeBuild({ cargo, level: spec.level, skillNodes, mentors, equipped, activeSkills }, content);
}
