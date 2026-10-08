import { create } from 'zustand';
import type { ProfessorId } from '@/game/content/types';

/**
 * The professor chosen to be honoured at the next graduation. Interface-only: it is handed to
 * `graduate()` when the player confirms, then cleared. Choosing nobody is the default.
 */
interface HonourPickStore {
  pick: ProfessorId | null;
  setPick(pick: ProfessorId | null): void;
}

export const useHonourPick = create<HonourPickStore>((set) => ({
  pick: null,
  setPick: (pick) => set({ pick }),
}));
