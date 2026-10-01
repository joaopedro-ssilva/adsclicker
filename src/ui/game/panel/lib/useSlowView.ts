import { useMemo, useState } from 'react';
import { content, useGame } from '@/game/store';
import type { GameContent } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';

/**
 * A state snapshot refreshed about once a second (and whenever `extraKey` changes) instead of at every tick.
 * For heavy lists that do not need 10 Hz precision, such as achievement progress.
 */
function useSlowState(extraKey: string | number): GameState {
  const second = useGame((store) => Math.floor(store.state.lastTickAt / 1000));
  const key = `${second}:${extraKey}`;
  const [snapshot, setSnapshot] = useState(() => useGame.getState().state);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setSnapshot(useGame.getState().state);
  }
  return snapshot;
}

/** Like useGameView, but rebuilt about once a second. `build` must be a stable reference. */
export function useSlowView<T>(build: (state: GameState, content: GameContent) => T, extraKey: string | number = 0): T {
  const snapshot = useSlowState(extraKey);
  return useMemo(() => build(snapshot, content), [build, snapshot]);
}
