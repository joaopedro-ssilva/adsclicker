import type { HackathonContent, Modifier, Stats, UniqueEffect } from '../content/types';
import { SLOT_IDS } from '../content/types';
import type { Build, BuildInput } from './types';
import { indexOf } from './contentIndex';
import { addModifier, emptyMeta, resolveMeta, resolveStats } from './modifiers';
import type { Totals } from './modifiers';

/** Stats of a bare student: base plus growth per level. */
export function baseStats(level: number, content: HackathonContent): Stats {
  const { baseStats: base, statsPerLevel } = content.config;
  const grown = { ...base };
  for (const id of Object.keys(grown) as (keyof Stats)[]) {
    grown[id] = base[id] + (statsPerLevel[id] ?? 0) * (level - 1);
  }
  return grown;
}

/** Active skills the player can really use: chosen, unlocked by an owned node, cut to the slots, plus item grants. */
function activeSkills(input: BuildInput, granted: string[], content: HackathonContent): string[] {
  const index = indexOf(content);
  const slots = index.cargos.get(input.cargo)?.skillSlots ?? 0;
  const unlocked = new Set<string>();
  for (const node of content.skillNodes) {
    if (node.unlocksSkill && (input.skillNodes[node.id] ?? 0) > 0) unlocked.add(node.unlocksSkill);
  }
  const chosen: string[] = [];
  for (const id of input.activeSkills) {
    if (chosen.length >= slots) break;
    if (unlocked.has(id) && index.skills.has(id) && !chosen.includes(id)) chosen.push(id);
  }
  for (const id of granted) {
    if (index.skills.has(id) && !chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}

export function computeBuild(input: BuildInput, content: HackathonContent): Build {
  const index = indexOf(content);
  const level = Math.max(1, Math.floor(input.level));
  const totals: Totals = {};
  const uniques: UniqueEffect[] = [];
  const grantedSkills: string[] = [];
  const setCounts = new Map<string, number>();

  for (const node of content.skillNodes) {
    const owned = Math.min(input.skillNodes[node.id] ?? 0, node.maxLevel);
    if (owned > 0) for (const modifier of node.modifiers) addModifier(totals, modifier, owned);
  }

  for (const [professor, owned] of Object.entries(input.mentors)) {
    const mentor = index.mentors.get(professor);
    const levels = Math.min(owned ?? 0, mentor?.costs.length ?? 0);
    if (mentor && levels > 0) for (const modifier of mentor.modifiers) addModifier(totals, modifier, levels);
  }

  for (const slot of SLOT_IDS) {
    const item = input.equipped[slot];
    if (!item) continue;
    for (const affix of item.affixes) addModifier(totals, affix);
    const base = index.items.get(item.base);
    if (!base) continue;
    if (base.set) setCounts.set(base.set, (setCounts.get(base.set) ?? 0) + 1);
    if (item.rarity !== 'lendario') continue;
    uniques.push(base.unique);
    if (base.unique.kind === 'modifiers') for (const modifier of base.unique.modifiers) addModifier(totals, modifier);
    if (base.unique.kind === 'skill') grantedSkills.push(base.unique.skill);
  }

  // Set bonuses are scaled by the setBonus meta that everything else produced.
  const setScale = 1 + resolveMeta(emptyMeta(), totals).setBonus / 100;
  const sets: Record<string, number> = {};
  for (const [setId, pieces] of setCounts) {
    if (pieces < 2) continue;
    sets[setId] = pieces;
    const bonuses: Modifier[] = [];
    for (const bonus of index.sets.get(setId)?.bonuses ?? []) {
      if (pieces >= bonus.pieces) bonuses.push(...bonus.modifiers);
    }
    for (const modifier of bonuses) addModifier(totals, modifier, setScale);
  }

  return {
    stats: resolveStats(baseStats(level, content), totals),
    meta: resolveMeta(emptyMeta(), totals),
    skills: activeSkills(input, grantedSkills, content),
    uniques,
    sets,
  };
}
