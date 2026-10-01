import { create } from 'zustand';
import type { ProfessorId, Rarity } from '@/game/content/types';

export interface HireMoment {
  id: number;
  kind: 'hire';
  professor: ProfessorId;
}

export interface UnlockMoment {
  id: number;
  kind: 'unlock';
  item: 'skin' | 'scenery' | 'theme';
  itemId: string;
  rarity: Rarity;
}

export interface GraduateMoment {
  id: number;
  kind: 'graduate';
  diplomas: number;
}

/** Ceremonies that take the screen and wait for the player. */
export type BlockingMoment = HireMoment | GraduateMoment | (UnlockMoment & { rarity: 'epic' | 'legendary' });

type NewBlocking = Omit<HireMoment, 'id'> | Omit<GraduateMoment, 'id'>;

interface MomentsStore {
  /** One at a time, in order. The first is on screen. */
  queue: BlockingMoment[];
  /** Quick unlock cards (common and rare): they never block play. */
  cards: UnlockMoment[];
  push(moment: NewBlocking): void;
  pushUnlock(moment: Omit<UnlockMoment, 'id' | 'kind'>): void;
  dismiss(id: number): void;
  dismissCard(id: number): void;
  clear(): void;
}

let sequence = 0;
const MAX_CARDS = 2;

export const useMoments = create<MomentsStore>((set) => ({
  queue: [],
  cards: [],
  push: (moment) => set((state) => ({ queue: [...state.queue, { ...moment, id: ++sequence }] })),
  pushUnlock: (moment) =>
    set((state) => {
      const entry: UnlockMoment = { ...moment, id: ++sequence, kind: 'unlock' };
      if (entry.rarity === 'epic' || entry.rarity === 'legendary') {
        return { queue: [...state.queue, entry as BlockingMoment] };
      }
      return { cards: [...state.cards, entry].slice(-MAX_CARDS) };
    }),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((moment) => moment.id !== id) })),
  dismissCard: (id) => set((state) => ({ cards: state.cards.filter((card) => card.id !== id) })),
  clear: () => set({ queue: [], cards: [] }),
}));
