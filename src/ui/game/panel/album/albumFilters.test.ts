import { describe, expect, it } from 'vitest';
import { NO_FILTERS, activeFilters, favouritesFirst, matches } from './albumFilters';
import type { AlbumFilters, Filterable } from './albumFilters';

const cafe: Filterable = { name: 'Edécio Café', professor: 'edecio', rarity: 'rare', owned: true, favourite: false };
const locked: Filterable = { name: 'Edécio Samurai', professor: 'edecio', rarity: 'mythic', owned: false, favourite: false };
const only = (patch: Partial<AlbumFilters>): AlbumFilters => ({ ...NO_FILTERS, ...patch });

describe('album filters', () => {
  it('lets everything through with no filters', () => {
    expect(matches(cafe, NO_FILTERS)).toBe(true);
    expect(matches(locked, NO_FILTERS)).toBe(true);
    expect(activeFilters(NO_FILTERS)).toBe(0);
  });

  it('filters by professor, rarity, ownership and favourites', () => {
    expect(matches(cafe, only({ professor: 'gladimir' }))).toBe(false);
    expect(matches(cafe, only({ rarity: 'rare' }))).toBe(true);
    expect(matches(cafe, only({ rarity: 'epic' }))).toBe(false);
    expect(matches(locked, only({ ownership: 'owned' }))).toBe(false);
    expect(matches(locked, only({ ownership: 'missing' }))).toBe(true);
    expect(matches(cafe, only({ favouritesOnly: true }))).toBe(false);
    expect(matches({ ...cafe, favourite: true }, only({ favouritesOnly: true }))).toBe(true);
  });

  it('searches by name ignoring case and accents, but never finds a locked name', () => {
    expect(matches(cafe, only({ query: 'edecio cafe' }))).toBe(true);
    expect(matches(cafe, only({ query: 'CAFÉ' }))).toBe(true);
    expect(matches(locked, only({ query: 'samurai' }))).toBe(false);
  });

  it('counts the active filters', () => {
    expect(activeFilters(only({ query: ' x ', rarity: 'epic', favouritesOnly: true }))).toBe(3);
    expect(activeFilters(only({ query: '   ' }))).toBe(0);
  });

  it('puts favourites first and keeps the rest in order', () => {
    expect(favouritesFirst([1, 2, 3, 4, 5], (n) => n === 4 || n === 2)).toEqual([2, 4, 1, 3, 5]);
  });
});
