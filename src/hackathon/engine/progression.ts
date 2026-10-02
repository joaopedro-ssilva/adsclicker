import type { ProfessorId } from '@/game/content/types';
import type { CargoId, HackathonContent } from '../content/types';
import { indexOf } from './contentIndex';
import type { ClassroomBonus, LevelProgress } from './types';

export function xpToNext(level: number, content: HackathonContent): number {
  const { xpBase, xpStep } = content.config;
  return Math.max(1, Math.round(xpBase + xpStep * (Math.max(1, level) - 1)));
}

/** Levels up through the cargo's cap; at the cap the XP bar stays full, waiting for a promotion. */
export function applyXp(
  current: { cargo: CargoId; level: number; xp: number },
  amount: number,
  content: HackathonContent,
): LevelProgress {
  const cap = indexOf(content).cargos.get(current.cargo)?.maxLevel ?? current.level;
  let level = current.level;
  let xp = current.xp + Math.max(0, Math.floor(amount));
  while (level < cap && xp >= xpToNext(level, content)) {
    xp -= xpToNext(level, content);
    level += 1;
  }
  if (level >= cap) xp = Math.min(xp, xpToNext(level, content));
  return { level, xp, levelsGained: level - current.level };
}

function spentPoints(skillNodes: Record<string, number>, content: HackathonContent): number {
  let spent = 0;
  for (const node of content.skillNodes) spent += node.cost * Math.min(skillNodes[node.id] ?? 0, node.maxLevel);
  return spent;
}

export function freeSkillPoints(level: number, skillNodes: Record<string, number>, content: HackathonContent): number {
  return Math.max(0, level - 1 - spentPoints(skillNodes, content));
}

/** `level` is the player's level. The reason is shown to the player as is. */
export function nodeLock(
  node: string,
  level: number,
  skillNodes: Record<string, number>,
  content: HackathonContent,
): string | null {
  const def = indexOf(content).nodes.get(node);
  if (!def) return 'Habilidade desconhecida.';
  if ((skillNodes[node] ?? 0) >= def.maxLevel) return 'Nível máximo alcançado.';
  for (const required of def.requires) {
    if ((skillNodes[required] ?? 0) < 1) {
      const name = indexOf(content).nodes.get(required)?.name ?? required;
      return `Requer "${name}".`;
    }
  }
  const free = freeSkillPoints(level, skillNodes, content);
  if (free < def.cost) {
    return `Faltam pontos de habilidade: custa ${def.cost}, você tem ${free}.`;
  }
  return null;
}

/** Commits for the next level of a mentor; `level` is the current one. Null when maxed or unknown. */
export function mentorCost(professor: ProfessorId, level: number, content: HackathonContent): number | null {
  const cost = indexOf(content).mentors.get(professor)?.costs[level];
  return cost === undefined ? null : cost;
}

export function classroomBonus(
  input: { cargo: CargoId; mentors: Partial<Record<ProfessorId, number>> },
  content: HackathonContent,
): ClassroomBonus {
  const index = indexOf(content);
  const mentors: Partial<Record<ProfessorId, number>> = {};
  for (const mentor of content.mentors) {
    const owned = Math.min(input.mentors[mentor.professor] ?? 0, mentor.costs.length);
    if (owned > 0) {
      mentors[mentor.professor] = Math.round((1 + content.config.mentorClassroomBonus * owned) * 10000) / 10000;
    }
  }
  return { cargo: index.cargos.get(input.cargo)?.classroomMultiplier ?? 1, mentors };
}
