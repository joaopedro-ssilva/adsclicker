/**
 * Tiny in-memory cache for the public reads (boards and community), which are the same for
 * everybody: one query per key per TTL per server instance, whatever the traffic. Concurrent
 * misses share one load, and when a reload fails the previous value keeps being served.
 */
export const PUBLIC_CACHE_TTL_MS = 10_000;
const RETRY_AFTER_FAILURE_MS = 2_000;

interface Entry<T> {
  value?: T;
  loadedAt: number;
  pending?: Promise<T>;
}

export interface TtlCache<T> {
  get(key: string, now?: number): Promise<T>;
  clear(): void;
}

export function createTtlCache<T>(load: (key: string, now: number) => Promise<T>, ttlMs: number = PUBLIC_CACHE_TTL_MS): TtlCache<T> {
  const entries = new Map<string, Entry<T>>();

  return {
    async get(key, now = Date.now()) {
      let entry = entries.get(key);
      if (!entry) {
        entry = { loadedAt: 0 };
        entries.set(key, entry);
      }
      if (entry.value !== undefined && now - entry.loadedAt < ttlMs) return entry.value;
      if (entry.pending) return entry.pending;

      const target = entry;
      target.pending = load(key, now)
        .then((value) => {
          target.value = value;
          target.loadedAt = now;
          return value;
        })
        .catch((error: unknown) => {
          if (target.value === undefined) throw error;
          // Serve the stale value and try again soon instead of hammering a failing database.
          target.loadedAt = now - ttlMs + RETRY_AFTER_FAILURE_MS;
          return target.value;
        })
        .finally(() => {
          target.pending = undefined;
        });
      return target.pending;
    },
    clear() {
      entries.clear();
    },
  };
}

/** The header of the public reads: shared caches may keep them for as long as the server does. */
export const PUBLIC_CACHE_CONTROL = 'public, s-maxage=10, stale-while-revalidate=30';
