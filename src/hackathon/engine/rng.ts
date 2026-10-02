/**
 * Seeded integer PRNG for the simulation. Only `Math.imul`, shifts, xor and one exact division by
 * 2^32, so every JavaScript engine produces the same stream. Never use Math.random in the engine.
 */
export type Stream = () => number;

/** Avalanche mix of a 32-bit integer (murmur3 finalizer). */
export function mix32(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** mulberry32: returns floats in [0, 1). */
export function mulberry32(seed: number): Stream {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stream salts: one per kind of roll, so a player action never shifts an unrelated roll. */
export const SALT = { waves: 1, offers: 2, crit: 3, splash: 4, daily: 5 } as const;

/** Independent stream for one purpose: the same seed with another salt gives an unrelated sequence. */
export function createStream(seed: number, salt: number): Stream {
  return mulberry32(mix32((seed >>> 0) ^ Math.imul(salt + 1, 0x9e3779b1)));
}

/** FNV-1a of a string, used to turn a date key into a seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer in [0, n). */
export function randInt(stream: Stream, n: number): number {
  return Math.floor(stream() * n);
}

export function pickOne<T>(stream: Stream, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[randInt(stream, items.length)];
}

/** Fisher-Yates on a copy. */
export function shuffled<T>(stream: Stream, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(stream, i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** Distinct picks (at most `count`), in a random order. */
export function sample<T>(stream: Stream, items: readonly T[], count: number): T[] {
  return shuffled(stream, items).slice(0, Math.max(0, count));
}
