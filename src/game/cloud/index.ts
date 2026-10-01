import { api } from '@/shared/apiClient';
import { browserEnv, browserStorage, liveGame } from './browser';
import { createCloudStore } from './createCloud';

export type * from './types';
export { moreProgress, summarizeState } from './summary';

/**
 * The cloud store. Importing it touches no browser API: GameApp calls `useCloud.getState().start()`
 * from an effect once the game is ready.
 */
export const useCloud = createCloudStore({
  api,
  game: liveGame,
  env: browserEnv,
  storage: browserStorage,
  now: () => Date.now(),
  timers: { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) },
});
