import { content } from '@/game/store';
import { researchViews } from '@/game/engine/views';
import type { GameState } from '@/game/engine/state';
import type { ResearchView } from '@/game/store';

const cache = new WeakMap<GameState, ResearchView[]>();

/**
 * researchViews shared by every subscriber of one state snapshot. The tab dot, the lists and each card
 * select from the store at every publish, so without this the 40 views would be rebuilt once per subscriber.
 */
export function cachedResearchViews(state: GameState): ResearchView[] {
  let views = cache.get(state);
  if (!views) {
    views = researchViews(state, content);
    cache.set(state, views);
  }
  return views;
}
