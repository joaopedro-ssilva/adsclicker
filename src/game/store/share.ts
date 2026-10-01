import { Decimal } from '../engine/decimal';
import type { GameState } from '../engine/state';

/**
 * The engine mutates one working GameState in place. What the UI sees is an immutable copy made
 * after every mutation, with structural sharing: any nested object that did not change keeps the
 * reference it had in the previous copy. So selectors on nested data (`s.state.levels`) only fire
 * when that data really changed, and the top-level reference is always new.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Decimal);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const key in value) copy[key] = cloneValue(value[key]);
    return copy;
  }
  return value; // primitives and Decimals (immutable)
}

function shareValue(previous: unknown, next: unknown): unknown {
  if (previous === next) return next;
  if (previous instanceof Decimal && next instanceof Decimal) {
    return previous.m === next.m && previous.e === next.e ? previous : next;
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const items = next.map((item, i) => shareValue(previous[i], item));
    return items.length === previous.length && items.every((item, i) => item === previous[i]) ? previous : items;
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next);
    const merged: Record<string, unknown> = {};
    let unchanged = keys.length === Object.keys(previous).length;
    for (const key of keys) {
      const value = shareValue(previous[key], next[key]);
      merged[key] = value;
      if (value !== previous[key] || !(key in previous)) unchanged = false;
    }
    return unchanged ? previous : merged;
  }
  return next;
}

/** A deep copy that shares Decimals (they are immutable). */
export function cloneState(state: GameState): GameState {
  return cloneValue(state) as GameState;
}

/** Deep-copies `next` and reuses every subtree of `previous` that is equal. The result's top level is always a new object. */
export function publishState(previous: GameState, next: GameState): GameState {
  const shared = shareValue(previous, cloneState(next)) as GameState;
  return shared === previous ? { ...previous } : shared;
}
