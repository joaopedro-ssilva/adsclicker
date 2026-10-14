import type { GameContent } from '../content/types';
import { getIndex } from './contentIndex';
import type { GameState } from './state';

export type FavouriteKind = 'skin' | 'scenery' | 'theme';

/** Key of a favourite in `GameState.favourites`: ids are only unique inside their own kind. */
export function favouriteKey(kind: FavouriteKind, id: string): string {
  return `${kind}:${id}`;
}

/** Whether a favourite key points at a cosmetic that exists and is owned. */
export function isValidFavourite(state: GameState, content: GameContent, key: string): boolean {
  const split = key.indexOf(':');
  const kind = key.slice(0, split);
  const id = key.slice(split + 1);
  const index = getIndex(content);
  if (kind === 'skin') return index.skins.has(id) && state.skins[id] === true;
  if (kind === 'scenery') return index.sceneries.has(id) && state.sceneries[id] === true;
  if (kind === 'theme') return index.themes.has(id) && state.themes[id] === true;
  return false;
}

/** Stars or unstars an owned skin, scenery or theme. Cosmetic only: touches nothing the economy reads. */
export function toggleFavourite(state: GameState, content: GameContent, kind: FavouriteKind, id: string): boolean {
  const key = favouriteKey(kind, id);
  if (!isValidFavourite(state, content, key)) return false;
  if (state.favourites[key]) delete state.favourites[key];
  else state.favourites[key] = true;
  return true;
}
