import { create } from 'zustand';
import type { ProfessorId } from '@/game/content/types';

/**
 * Which professors' skin groups the player folded in the Album. Interface-only: kept on this device in
 * localStorage, never in the save. Every group starts open.
 */
const KEY = 'adsclicker.album.collapsed';

function read(): Partial<Record<ProfessorId, boolean>> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<ProfessorId, boolean>>) : {};
  } catch {
    return {};
  }
}

function write(collapsed: Partial<Record<ProfessorId, boolean>>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(collapsed));
  } catch {
    // Private mode or blocked storage: the groups just start open next time.
  }
}

interface CollapsedStore {
  collapsed: Partial<Record<ProfessorId, boolean>>;
  toggle(professor: ProfessorId): void;
}

export const useCollapsedGroups = create<CollapsedStore>((set, get) => ({
  collapsed: typeof window === 'undefined' ? {} : read(),
  toggle: (professor) => {
    const next = { ...get().collapsed, [professor]: !get().collapsed[professor] };
    write(next);
    set({ collapsed: next });
  },
}));
