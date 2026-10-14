import { create } from 'zustand';

/**
 * How the achievements list is filtered and ordered. Interface-only: kept on this device in localStorage, never
 * in the save and never read by the engine.
 */
export type AchievementFilter = 'all' | 'done' | 'missing';
export type AchievementOrder = 'family' | 'closest';

const KEY = 'adsclicker.album.achievementView';

interface Stored {
  filter: AchievementFilter;
  order: AchievementOrder;
}

const DEFAULTS: Stored = { filter: 'all', order: 'family' };

function read(): Stored {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Stored> | null;
    return {
      filter: parsed?.filter === 'done' || parsed?.filter === 'missing' ? parsed.filter : 'all',
      order: parsed?.order === 'closest' ? 'closest' : 'family',
    };
  } catch {
    return DEFAULTS;
  }
}

function write(view: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    // Private mode or blocked storage: the list just starts unfiltered next time.
  }
}

interface AchievementViewStore extends Stored {
  setFilter(filter: AchievementFilter): void;
  setOrder(order: AchievementOrder): void;
}

export const useAchievementView = create<AchievementViewStore>((set, get) => ({
  ...(typeof window === 'undefined' ? DEFAULTS : read()),
  setFilter: (filter) => {
    write({ filter, order: get().order });
    set({ filter });
  },
  setOrder: (order) => {
    write({ filter: get().filter, order });
    set({ order });
  },
}));
