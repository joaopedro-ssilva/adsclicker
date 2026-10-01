import type { GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { checkAchievements, checkAchievementsThrottled } from './achievements';
import { settleSprint } from './sprints';
import type { GameState } from './state';
import { invalidateStats } from './stats';

export interface AfterActionOptions {
  /** Skip the achievement scan when one ran less than a second ago (frequent actions such as clicks). */
  throttle?: boolean;
}

/**
 * What every state-changing action does when it is done: settle the running sprint, scan the
 * achievements and drop the cached stats of the mutated state.
 */
export function afterAction(
  state: GameState,
  content: GameContent,
  now: number,
  emit: Emit,
  options: AfterActionOptions = {},
): void {
  invalidateStats(state);
  settleSprint(state, content, now, emit);
  if (options.throttle) checkAchievementsThrottled(state, content, now, emit);
  else checkAchievements(state, content, now, emit);
  invalidateStats(state);
}
