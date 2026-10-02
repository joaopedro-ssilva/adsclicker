import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';
import type { HackathonContent, StageDef } from '@/hackathon/content/types';

/** The part of a cloud save the Hackathon cares about. */
export type SaveView = Pick<GameState, 'hired' | 'achievements'>;

/** Hired now or at any time before (the `hire-<id>` achievement outlives a graduation). */
export function wasHired(save: SaveView | null, professor: ProfessorId): boolean {
  if (!save) return false;
  return save.hired[professor] === true || (save.achievements[`hire-${professor}`] ?? 0) > 0;
}

export const LOCK_NO_SAVE = 'Jogue a sala de aula online primeiro: o Hackathon abre quando você contrata a Bruna B2.';
export const LOCK_NO_B2 = 'O Hackathon abre quando você contrata a Bruna B2 (o terceiro professor) na sala de aula.';

/** Why the mode is closed, or null when the third professor (Bruna B2) was hired at least once. */
export function hackathonLock(save: SaveView | null): string | null {
  if (!save) return LOCK_NO_SAVE;
  return wasHired(save, 'b2') ? null : LOCK_NO_B2;
}

/** Edécio is always a mentor; the others once hired. */
export function unlockedMentors(save: SaveView | null): Record<ProfessorId, boolean> {
  const result = {} as Record<ProfessorId, boolean>;
  for (const id of PROFESSOR_IDS) result[id] = id === 'edecio' || wasHired(save, id);
  return result;
}

/** Why a campaign stage is closed to this player (pt-BR), or null when open. */
export function stageLock(stage: StageDef, level: number, clears: Record<string, number>, content: HackathonContent): string | null {
  if (level < stage.requiredLevel) return `Você precisa do nível ${stage.requiredLevel} para entrar nesta fase.`;
  if (stage.requires !== null && (clears[stage.requires] ?? 0) < 1) {
    const previous = content.stages.find((candidate) => candidate.id === stage.requires);
    return `Vença a fase "${previous?.name ?? stage.requires}" antes.`;
  }
  return null;
}
