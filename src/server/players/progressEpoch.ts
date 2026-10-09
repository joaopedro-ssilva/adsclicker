import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appConfig } from '../db/schema';

/**
 * The progress epoch: a counter in app_config that the launch reset (players/launchReset.ts)
 * bumps. Every account carries the epoch it is at (`players.progress_epoch`) and a device sends
 * the epoch it last saw with each sync; when they differ the sync is refused with
 * `status: 'reset'` and nothing is written, so a save from before the reset can never put
 * progress back on the boards. Before any reset the epoch is 0, which is also what an old client
 * (that sends none) is taken to hold, so nothing changes until the owner runs the reset.
 */
export const EPOCH_KEY = 'progress_epoch';

/** The current epoch. Not cached: it is read when a guest is created or a device without a session asks, which is rare. */
export async function readProgressEpoch(db: Pick<Db, 'select'>): Promise<number> {
  const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, EPOCH_KEY)).limit(1);
  return typeof row?.value === 'number' && Number.isInteger(row.value) && row.value >= 0 ? row.value : 0;
}

/** Adds one to the epoch, atomically, and returns the new value. Meant to run inside the reset transaction. */
export async function bumpProgressEpoch(db: Pick<Db, 'execute'>, now: number = Date.now()): Promise<number> {
  const at = new Date(now).toISOString();
  const rows = await db.execute<{ value: number }>(sql`
    insert into app_config (key, value, updated_at)
    values (${EPOCH_KEY}, to_jsonb(1), ${at}::timestamptz)
    on conflict (key) do update
      set value = to_jsonb(coalesce((app_config.value #>> '{}')::int, 0) + 1), updated_at = excluded.updated_at
    returning (value #>> '{}')::int as value`);
  const value = rows[0]?.value;
  if (typeof value !== 'number') throw new Error('progress epoch bump returned no row');
  return value;
}
