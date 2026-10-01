import { describe, expect, it } from 'vitest';
import { cleanCoins } from './community';
import { createTtlCache } from './cache';

describe('createTtlCache', () => {
  it('loads once per TTL and shares concurrent misses', async () => {
    let loads = 0;
    const cache = createTtlCache(async () => ++loads, 10_000);
    const [a, b] = await Promise.all([cache.get('k', 0), cache.get('k', 0)]);
    expect([a, b, loads]).toEqual([1, 1, 1]);
    expect(await cache.get('k', 9_999)).toBe(1);
    expect(await cache.get('k', 10_000)).toBe(2);
    expect(await cache.get('other', 10_000)).toBe(3);
  });

  it('keeps serving the stale value when a reload fails, and retries soon', async () => {
    let fail = false;
    let loads = 0;
    const cache = createTtlCache(async () => {
      loads += 1;
      if (fail) throw new Error('database down');
      return loads;
    }, 10_000);
    expect(await cache.get('k', 0)).toBe(1);
    fail = true;
    expect(await cache.get('k', 10_000)).toBe(1);
    // Not hammered: within the retry delay nothing reloads.
    expect(await cache.get('k', 11_000)).toBe(1);
    expect(loads).toBe(2);
    fail = false;
    expect(await cache.get('k', 12_000)).toBe(3);
  });

  it('throws when the very first load fails, and recovers on the next call', async () => {
    let fail = true;
    const cache = createTtlCache(async () => {
      if (fail) throw new Error('database down');
      return 'ok';
    });
    await expect(cache.get('k', 0)).rejects.toThrow('database down');
    fail = false;
    expect(await cache.get('k', 1)).toBe('ok');
  });
});

describe('cleanCoins', () => {
  it('turns to_char output into the notation the game reads', () => {
    expect(cleanCoins('  3.8645849252e+05')).toBe('3.8645849252e5');
    expect(cleanCoins('  1.5000000000e+300')).toBe('1.5e300');
    expect(cleanCoins('  1.0000000000e+00')).toBe('1e0');
    expect(cleanCoins('  0.0000000000e+00')).toBe('0');
    expect(cleanCoins(null)).toBe('0');
    expect(cleanCoins('garbage')).toBe('0');
  });
});
