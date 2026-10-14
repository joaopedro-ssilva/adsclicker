import type { ProfessorId, Rarity } from '@/game/content/types';

/** What the filter bar of one Album section holds. */
export interface AlbumFilters {
  query: string;
  /** Skins only. */
  professor: ProfessorId | 'all';
  /** Skins only. */
  rarity: Rarity | 'all';
  ownership: 'all' | 'owned' | 'missing';
  favouritesOnly: boolean;
}

export const NO_FILTERS: AlbumFilters = { query: '', professor: 'all', rarity: 'all', ownership: 'all', favouritesOnly: false };

/** How many filters are active (the search counts as one). */
export function activeFilters(filters: AlbumFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    (filters.professor !== 'all' ? 1 : 0) +
    (filters.rarity !== 'all' ? 1 : 0) +
    (filters.ownership !== 'all' ? 1 : 0) +
    (filters.favouritesOnly ? 1 : 0)
  );
}

/** Lower case, no accents: "cafe" finds "Café". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export interface Filterable {
  name: string;
  professor?: ProfessorId;
  rarity?: Rarity;
  owned: boolean;
  favourite: boolean;
}

/** The name of a locked item is hidden (???), so the search cannot find it by name: that would spoil it. */
export function matches(item: Filterable, filters: AlbumFilters): boolean {
  if (filters.professor !== 'all' && item.professor !== filters.professor) return false;
  if (filters.rarity !== 'all' && item.rarity !== filters.rarity) return false;
  if (filters.ownership === 'owned' && !item.owned) return false;
  if (filters.ownership === 'missing' && item.owned) return false;
  if (filters.favouritesOnly && !item.favourite) return false;
  const query = normalize(filters.query);
  if (query && !(item.owned && normalize(item.name).includes(query))) return false;
  return true;
}

/** Favourites first; everything else keeps its order. */
export function favouritesFirst<T>(items: readonly T[], isFavourite: (item: T) => boolean): T[] {
  return [...items.filter(isFavourite), ...items.filter((item) => !isFavourite(item))];
}
