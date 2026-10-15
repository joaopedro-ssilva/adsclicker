import { content } from '@/game/content';
import { trustedNow } from '../clock/trustedClock';
import { createGameStore } from './createStore';

export { content };

/**
 * The game store. `state` is the published GameState; the actions are the GameActions of
 * store/types.ts. Importing this file touches no browser API: call `useGame.getState().boot()`
 * from an effect on the client. The loop reads the clock captured when the page loaded
 * (clock/trustedClock.ts), so a `Date.now` patched from the console later does not speed it up.
 */
export const useGame = createGameStore({ content, now: trustedNow });
