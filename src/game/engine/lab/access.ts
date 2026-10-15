import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';

/** Pablo is hired: the slot of the Laboratório shows (locked until the diplomas are paid). */
export function labSlotVisible(state: GameState, content: GameContent): boolean {
  return state.lab.unlocked || state.hired[content.lab.unlock.professor];
}

export function labCanUnlock(state: GameState, content: GameContent): boolean {
  const { unlock } = content.lab;
  return !state.lab.unlocked && state.hired[unlock.professor] && state.diplomas >= unlock.diplomas;
}

/** Spends the diplomas, once. The production bonus counts diplomas earned, so nothing is lost. */
export function unlockLab(state: GameState, content: GameContent, emit: Emit): boolean {
  if (!labCanUnlock(state, content)) return false;
  state.diplomas -= content.lab.unlock.diplomas;
  state.lab.unlocked = true;
  emit({ type: 'labUnlocked' });
  return true;
}

export interface LabAvailability {
  /** The run and the bench can be used in this turma. */
  ok: boolean;
  /** Disciplines (aulas) still at level 0. */
  missing: number;
  /** Why not, ready to show: "Faltam 5 aulas". Null when ok. */
  reason: string | null;
}

/**
 * The one rule of the per-turma gate: the run and the inventory exist in a turma only when every discipline (aula) of
 * the game is at level 1 or more.
 */
export function labRunAvailable(state: GameState, content: GameContent): LabAvailability {
  if (!state.lab.unlocked) {
    return { ok: false, missing: content.disciplines.length, reason: 'Desbloqueie o Laboratório com diplomas' };
  }
  const missing = content.disciplines.filter((def) => (state.levels[def.id] ?? 0) < 1).length;
  if (missing === 0) return { ok: true, missing: 0, reason: null };
  return { ok: false, missing, reason: missing === 1 ? 'Falta 1 aula' : `Faltam ${missing} aulas` };
}
