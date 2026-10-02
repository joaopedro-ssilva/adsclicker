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

const SKILL_KINDS_PLAN = ['aoe', 'block'] as const;
const PRIORITY_BOSS = ['block', 'aoe', 'heal', 'haste'];
const PRIORITY_STAGE = ['aoe', 'heal', 'block', 'haste'];

/** Skills a sensible student unlocks: the area attack first (cheap), then the block for the boss. */
function defaultPlan(content: HackathonContent): string[] {
  return SKILL_KINDS_PLAN.flatMap((kind) => content.skills.filter((s) => s.effect.kind === kind).map((s) => s.id));
}

/** Which of the owned skills go in the slots: the block against a boss, the area attack otherwise. */
export function chooseActive(owned: string[], facingBoss: boolean, slots: number, content: HackathonContent): string[] {
  const priority = facingBoss ? PRIORITY_BOSS : PRIORITY_STAGE;
  const rank = (id: string): number => priority.indexOf(content.skills.find((s) => s.id === id)?.effect.kind ?? '');
  return [...owned].sort((a, b) => rank(a) - rank(b)).slice(0, slots);
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
  content: HackathonContent,
  wanted?: string[],
): { skillNodes: Record<string, number>; activeSkills: string[] } {
  const goals = wanted ?? defaultPlan(content);
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
  /** Skills to unlock and equip, in order of priority (default: area attack, then block). */
  skills?: string[];
}

/** Rough fighting power of a build: damage per second times effective HP. */
function power(build: Build): number {
  const { logica, agilidade, foco, resiliencia } = build.stats;
  return logica * (agilidade / 100) * foco * (1 + resiliencia / 100);
}

/**
 * A decent item for the slot: of all its bases (set pieces apart) rolled at the same rarity, the
 * second best for a bare student in a fight (a careful player has the best one only sometimes).
 */
function decentItem(slot: SlotId, rarity: ItemRarity, level: number, content: HackathonContent): ItemInstance | null {
  const bare = computeBuild({ cargo: 'estudante', level, skillNodes: {}, mentors: {}, equipped: {}, activeSkills: [] }, content);
  const candidates = content.items
    .filter((b) => b.slot === slot && !b.set)
    .flatMap((b) => typicalItem(b.id, rarity, level, content) ?? [])
    .map((item) => ({
      item,
      value: power(computeBuild({ cargo: 'estudante', level, skillNodes: {}, mentors: {}, equipped: { [slot]: item }, activeSkills: [] }, content)) - power(bare),
    }))
    .sort((a, b) => a.value - b.value);
  return (candidates[candidates.length - 2] ?? candidates[candidates.length - 1])?.item ?? null;
}

/** A student with spent skill points and, optionally, a decent item of one rarity in every slot. */
export function buildStudent(spec: StudentSpec, content: HackathonContent, facingBoss = false): Build {
  const cargo = cargoForLevel(spec.level, content);
  const { skillNodes, activeSkills: owned } = allocateSkills(spec.level, content, spec.skills);
  const slots = indexOf(content).cargos.get(cargo)?.skillSlots ?? 0;
  const activeSkills = spec.skills ? owned.slice(0, slots) : chooseActive(owned, facingBoss, slots, content);
  const equipped: Partial<Record<SlotId, ItemInstance>> = {};
  if (spec.gear) {
    for (const slot of SLOT_IDS) {
      const item = decentItem(slot, spec.gear, spec.itemLevel ?? spec.level, content);
      if (item) equipped[slot] = item;
    }
  }
  const mentors: BuildInput['mentors'] = {};
  for (const mentor of content.mentors) mentors[mentor.professor] = Math.min(spec.mentorLevel ?? 0, mentor.costs.length);
  return computeBuild({ cargo, level: spec.level, skillNodes, mentors, equipped, activeSkills }, content);
}
