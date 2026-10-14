import { create } from 'zustand';
import type { Rarity } from '@/game/content/types';
import { PROFESSOR_IDS } from '@/game/content/types';
import { NO_FILTERS } from './albumFilters';
import type { AlbumFilters } from './albumFilters';

/**
 * The Album filters, one set per section. Interface-only: kept on this device in localStorage, never in the save.
 * A filter that hides everything is cleared by the "limpar" button, so a stale choice cannot trap the player.
 */
export type FilteredSection = 'skins' | 'cenarios' | 'temas';

const KEY = 'adsclicker.album.filters';
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

type AllFilters = Record<FilteredSection, AlbumFilters>;

function sanitize(value: unknown): AlbumFilters {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const professor = PROFESSOR_IDS.find((id) => id === raw.professor);
  const rarity = RARITIES.find((id) => id === raw.rarity);
  return {
    query: typeof raw.query === 'string' ? raw.query.slice(0, 40) : '',
    professor: professor ?? 'all',
    rarity: rarity ?? 'all',
    ownership: raw.ownership === 'owned' || raw.ownership === 'missing' ? raw.ownership : 'all',
    favouritesOnly: raw.favouritesOnly === true,
  };
}

function read(): AllFilters {
  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {
    // Unreadable: start with no filters.
  }
  return { skins: sanitize(parsed.skins), cenarios: sanitize(parsed.cenarios), temas: sanitize(parsed.temas) };
}

function write(filters: AllFilters) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(filters));
  } catch {
    // Private mode or blocked storage: the filters just start clear next time.
  }
}

interface FilterStore {
  filters: AllFilters;
  set(section: FilteredSection, patch: Partial<AlbumFilters>): void;
  clear(section: FilteredSection): void;
}

export const useAlbumFilters = create<FilterStore>((set, get) => ({
  filters: typeof window === 'undefined' ? { skins: NO_FILTERS, cenarios: NO_FILTERS, temas: NO_FILTERS } : read(),
  set: (section, patch) => {
    const filters = { ...get().filters, [section]: { ...get().filters[section], ...patch } };
    write(filters);
    set({ filters });
  },
  clear: (section) => {
    const filters = { ...get().filters, [section]: NO_FILTERS };
    write(filters);
    set({ filters });
  },
}));
