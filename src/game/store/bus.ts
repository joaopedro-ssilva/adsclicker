import type { GameEvent } from './types';

export type GameEventListener = (event: GameEvent) => void;

const listeners = new Set<GameEventListener>();

/** Announces something that happened. The store calls this after it publishes the new state. */
export function emitGameEvent(event: GameEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      // A broken listener (animation, sound) must never stop the game loop.
      console.error('[game event listener]', error);
    }
  }
}

/** Subscribes to every game event. Returns the unsubscribe function. */
export function subscribeGameEvents(listener: GameEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: drops every listener. */
export function clearGameEventListeners(): void {
  listeners.clear();
}
