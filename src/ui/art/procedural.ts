import { parseHex } from '../theme';

/** FNV-1a: a stable 32-bit hash so the same seed always draws the same sprite. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Small deterministic generator (LCG). Returns numbers in [0, 1). */
export function seededRandom(seed: string | number): () => number {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

/** Linear mix of two #rrggbb colours. Falls back to `a` when either is not a hex colour. */
export function mixColors(a: string, b: string, amount: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  return `#${from.map((channel, index) => toHex(channel + ((to[index] ?? channel) - channel) * amount)).join('')}`;
}

/** Positive amounts lighten, negative darken. */
export function shade(color: string, amount: number): string {
  return amount >= 0 ? mixColors(color, '#ffffff', amount) : mixColors(color, '#000000', -amount);
}
