import type { FxHandle } from './types';

let current: FxHandle | undefined;

/** Called by FxLayer when it mounts. The most recently mounted layer receives the calls. */
export function registerFx(handle: FxHandle): () => void {
  current = handle;
  return () => {
    if (current === handle) current = undefined;
  };
}

/**
 * Global entry point to the mounted FxLayer: fx.floatingNumber({ x, y, text }), fx.coins({ ..., target }), and so on.
 * Calls do nothing while no FxLayer is mounted, so event handlers never need to check.
 */
export const fx: FxHandle = {
  floatingNumber: (options) => current?.floatingNumber(options),
  coins: (options) => current?.coins(options),
  sparkles: (options) => current?.sparkles(options),
  confetti: (options) => current?.confetti(options),
  shake: (options) => current?.shake(options),
  clear: () => current?.clear(),
};
