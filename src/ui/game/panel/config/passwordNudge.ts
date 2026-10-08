import { useSyncExternalStore } from 'react';

/** Remembers, on this device, that the player dismissed the "set a password" notice for an account. */
const KEY = 'adsclicker.passwordNudgeDismissed';

const listeners = new Set<() => void>();
let memory: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True once the notice was dismissed for this player id. Server render and first paint say "dismissed" (no flash). */
export function usePasswordNudgeDismissed(playerId: string): boolean {
  const stored = useSyncExternalStore(subscribe, read, () => playerId);
  return stored === playerId;
}

export function dismissPasswordNudge(playerId: string): void {
  memory = playerId;
  try {
    window.localStorage.setItem(KEY, playerId);
  } catch {
    // storage blocked: dismissed for this visit only
  }
  listeners.forEach((listener) => listener());
}
