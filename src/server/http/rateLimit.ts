import { lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rateLimits } from '../db/schema';
import { ApiFailure } from './errors';

export interface RateRule {
  /** Name of the counter; part of the key. */
  scope: string;
  limit: number;
  windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The limits of docs/BACKEND.md (fixed windows). */
export const RATE_RULES = {
  /** Per IP. */
  login: { scope: 'login', limit: 10, windowMs: 10 * MINUTE },
  /** Per nickname, so a botnet cannot guess one account's password from many addresses. Looser: anyone can burn it. */
  loginNickname: { scope: 'login-nick', limit: 30, windowMs: 10 * MINUTE },
  /** Per IP. */
  guest: { scope: 'guest', limit: 20, windowMs: HOUR },
  /** Per player: the game syncs every 45 s plus after hires and graduations. */
  sync: { scope: 'sync', limit: 6, windowMs: MINUTE },
  /** Per player. */
  nickname: { scope: 'nickname', limit: 5, windowMs: HOUR },
  /** Per player; guesses at the current password. */
  password: { scope: 'password', limit: 10, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateRule>;

/** Start of the fixed window that contains `now`. */
export function windowStartOf(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/** Seconds until the window that contains `now` ends (at least 1). */
export function retryAfterSeconds(now: number, windowMs: number): number {
  return Math.max(1, Math.ceil((windowStartOf(now, windowMs) + windowMs - now) / 1000));
}

/**
 * Counts one hit against `rule` for `subject` (an IP hash, a player id, a nickname key) and
 * throws `rate_limited` once the window is over the limit. One upsert, no read-then-write race.
 */
export async function consume(db: Db, rule: RateRule, subject: string, now: number = Date.now()): Promise<void> {
  const windowStart = new Date(windowStartOf(now, rule.windowMs));
  const [row] = await db
    .insert(rateLimits)
    .values({ key: `${rule.scope}:${subject}`, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  if (row && row.count > rule.limit) {
    throw new ApiFailure('rate_limited', undefined, retryAfterSeconds(now, rule.windowMs));
  }
  sweepLater(db, now);
}

const SWEEP_EVERY_MS = 10 * MINUTE;
const KEEP_MS = 24 * HOUR;
let lastSweep = 0;

/** Old windows are useless; delete them at most every few minutes per instance, without waiting. */
function sweepLater(db: Db, now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  void db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now - KEEP_MS)))
    .catch(() => undefined);
}
