import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appConfig } from '../db/schema';

/**
 * The progress epoch: a counter in app_config. The launch reset that used to bump it was removed
 * (nothing in the code can wipe progress or move the counter any more), but production already ran
 * it once, so the check stays: every account carries the epoch it is at (`players.progress_epoch`)
 * and a device sends the epoch it last saw with each sync; when they differ the sync is refused with
 * `status: 'reset'` and nothing is written, so a save from before that reset can never put
 * progress back on the boards. This is read-only here: it only protects existing accounts.
 */
export const EPOCH_KEY = 'progress_epoch';

/** The current epoch. Not cached: it is read when a guest is created or a device without a session asks, which is rare. */
export async function readProgressEpoch(db: Pick<Db, 'select'>): Promise<number> {
  const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, EPOCH_KEY)).limit(1);
  return typeof row?.value === 'number' && Number.isInteger(row.value) && row.value >= 0 ? row.value : 0;
}
