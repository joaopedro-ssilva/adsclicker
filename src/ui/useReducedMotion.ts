'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';

/** The game's own "reduce motion" setting, provided by ThemeProvider. */
export const ReducedMotionContext = createContext(false);

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(notify: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/** True when either the OS preference or the game setting asks for less motion. */
export function useReducedMotion(): boolean {
  const setting = useContext(ReducedMotionContext);
  const system = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return setting || system;
}
