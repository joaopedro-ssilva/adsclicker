import { content } from '@/game/content';
import { createGameStore } from './createStore';

export { content };

/**
 * The game store. `state` is the published GameState; the actions are the GameActions of
 * store/types.ts. Importing this file touches no browser API: call `useGame.getState().boot()`
 * from an effect on the client.
 */
export const useGame = createGameStore({ content });
