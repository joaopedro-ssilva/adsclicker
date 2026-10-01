import type { CloudEnv, CloudGame } from './createCloud';
import { summarizeState } from './summary';
import type { StorageLike } from '../store/createStore';
import { subscribeGameEvents } from '../store/bus';
import { useGame } from '../store/useGame';

/** The live game store seen through the narrow interface the cloud needs. */
export const liveGame: CloudGame = {
  serialize: () => useGame.getState().serialize(),
  adopt: (serialized) => useGame.getState().importSave(serialized),
  summary: () => summarizeState(useGame.getState().state),
  multiplier: () => useGame.getState().state.settings.devMultiplier,
  setMultiplier: (value) => useGame.getState().updateSettings({ devMultiplier: value }),
  subscribe: subscribeGameEvents,
};

export const browserEnv: CloudEnv = {
  visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  onVisibility(listener) {
    const handler = () => listener(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
  onPageHide(listener) {
    window.addEventListener('pagehide', listener);
    return () => window.removeEventListener('pagehide', listener);
  },
};

export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
