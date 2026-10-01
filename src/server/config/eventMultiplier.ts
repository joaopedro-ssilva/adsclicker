import { eq } from 'drizzle-orm';
import { multiplierSchema } from '@/shared/api';
import type { Db } from '../db/client';
import { appConfig } from '../db/schema';

const KEY = 'event_multiplier';
/** Every sync reads the multiplier; the admin changes it rarely. A few seconds of delay is harmless. */
const TTL_MS = 5_000;

let cached: { value: number; at: number } | null = null;

/** The global event multiplier (1 = no event), cached in memory for a few seconds. */
export async function getEventMultiplier(db: Db, now: number = Date.now()): Promise<number> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, KEY)).limit(1);
  const parsed = multiplierSchema.safeParse(row?.value);
  const value = parsed.success ? parsed.data : 1;
  cached = { value, at: now };
  return value;
}

export async function setEventMultiplier(db: Db, value: number, now: number = Date.now()): Promise<void> {
  await db
    .insert(appConfig)
    .values({ key: KEY, value, updatedAt: new Date(now) })
    .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: new Date(now) } });
  cached = { value, at: now };
}

/** For tests. */
export function resetEventMultiplierCache(): void {
  cached = null;
}
