import { MAX_DEV_MULTIPLIER, MIN_DEV_MULTIPLIER } from '@/game/engine/state';

/**
 * The /admin coin multiplier lives in its own localStorage key, apart from the save,
 * so the admin page can change it without booting a second copy of the game and an
 * open game tab can follow it live through the browser's `storage` event.
 */
export const DEV_MULTIPLIER_KEY = 'adsclicker.dev-multiplier';

export function clampDevMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_DEV_MULTIPLIER, Math.max(MIN_DEV_MULTIPLIER, value));
}

export function readDevMultiplier(): number {
  try {
    const raw = window.localStorage.getItem(DEV_MULTIPLIER_KEY);
    return raw === null ? 1 : clampDevMultiplier(Number(raw));
  } catch {
    return 1;
  }
}

export function writeDevMultiplier(value: number): number {
  const multiplier = clampDevMultiplier(value);
  try {
    if (multiplier === 1) window.localStorage.removeItem(DEV_MULTIPLIER_KEY);
    else window.localStorage.setItem(DEV_MULTIPLIER_KEY, String(multiplier));
  } catch {
    // Storage blocked (private window): the multiplier simply does not stick.
  }
  return multiplier;
}
