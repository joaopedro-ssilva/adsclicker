import type { GameContent } from '../../content/types';
import type { GameState } from '../state';
import { atLevel } from './levelTable';
import { maestriaLevel } from './slots';

/**
 * Releases. The versions are not stored: they follow from the sprints completed in the run (which start again at
 * every graduation), so there is nothing to forge and nothing to forget. Raising the level can only shorten
 * the wait, and the limit of versions is a constant of the content.
 */

/** Sprints of the run for each version at the current level; 0 when B1's Maestria is not unlocked. */
export function releaseSprintsPerVersion(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'b1');
  return level > 0 ? atLevel(content.maestrias.releases.sprintsPerVersion, level) : 0;
}

/** Production each version adds (0.03 = +3%). */
export function releaseBonusPerVersion(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'b1');
  return level > 0 ? atLevel(content.maestrias.releases.bonus, level) : 0;
}

/** Versions shipped in this run, up to the limit. */
export function releaseVersions(state: GameState, content: GameContent): number {
  const per = releaseSprintsPerVersion(state, content);
  if (per <= 0) return 0;
  return Math.min(content.maestrias.releases.maxVersions, Math.floor(state.run.sprintsCompleted / per));
}

/** Multiplier on every source of coins: 1 + bonus x versions. */
export function releaseMultiplier(state: GameState, content: GameContent): number {
  const versions = releaseVersions(state, content);
  return versions > 0 ? 1 + releaseBonusPerVersion(state, content) * versions : 1;
}
