import { and, eq, inArray, sql } from 'drizzle-orm';
import { content as gameContent } from '@/game/content';
import { deserializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import type { ItemInstance } from '@/hackathon/engine/types';
import { itemInstanceSchema } from '@/shared/hackathonApi';
import type { Db } from '../db/client';
import { hackathonCollection, hackathonItems, hackathonProfiles, hackathonStages, players } from '../db/schema';

/** The handle inside `db.transaction`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Reads work on both the pool and a transaction. */
export type Executor = Db | Tx;
export type ProfileRow = typeof hackathonProfiles.$inferSelect;
export type ItemRow = typeof hackathonItems.$inferSelect;

/** The profile row, locked until the transaction ends: one writer per player at a time. */
export async function lockProfile(tx: Tx, playerId: string): Promise<ProfileRow | null> {
  const [row] = await tx.select().from(hackathonProfiles).where(eq(hackathonProfiles.playerId, playerId)).for('update');
  return row ?? null;
}

export async function readProfileRow(ex: Executor, playerId: string): Promise<ProfileRow | null> {
  const [row] = await ex.select().from(hackathonProfiles).where(eq(hackathonProfiles.playerId, playerId)).limit(1);
  return row ?? null;
}

export function itemFromRow(row: ItemRow): ItemInstance {
  return itemInstanceSchema.parse({
    id: row.id,
    base: row.base,
    rarity: row.rarity,
    level: row.level,
    affixes: row.affixes,
    quality: row.quality,
    rerolls: row.rerolls,
    createdAt: row.createdAt,
  });
}

export const itemToRow = (playerId: string, item: ItemInstance): ItemRow => ({
  id: item.id,
  playerId,
  base: item.base,
  rarity: item.rarity,
  level: item.level,
  affixes: item.affixes,
  quality: item.quality,
  rerolls: item.rerolls,
  createdAt: item.createdAt,
});

export async function loadItems(ex: Executor, playerId: string): Promise<ItemInstance[]> {
  const rows = await ex
    .select()
    .from(hackathonItems)
    .where(eq(hackathonItems.playerId, playerId))
    .orderBy(hackathonItems.createdAt, hackathonItems.id);
  return rows.map(itemFromRow);
}

export async function loadStageClears(ex: Executor, playerId: string): Promise<Record<string, number>> {
  const rows = await ex
    .select({ stageId: hackathonStages.stageId, clears: hackathonStages.clears })
    .from(hackathonStages)
    .where(eq(hackathonStages.playerId, playerId));
  return Object.fromEntries(rows.map((row) => [row.stageId, row.clears]));
}

export async function loadCollection(ex: Executor, playerId: string): Promise<string[]> {
  const rows = await ex
    .select({ base: hackathonCollection.base })
    .from(hackathonCollection)
    .where(eq(hackathonCollection.playerId, playerId));
  return rows.map((row) => row.base);
}

/** The player's cloud save as a game state, or null when they never synced one. */
export async function loadSave(ex: Executor, playerId: string, now: number): Promise<GameState | null> {
  const [row] = await ex.select({ save: players.save }).from(players).where(eq(players.id, playerId)).limit(1);
  return row?.save ? deserializeState(row.save, gameContent, now) : null;
}

/** Marks a stage won one more time; returns the new count and whether it was the first. */
export async function recordClear(tx: Tx, playerId: string, stageId: string, at: Date): Promise<{ clears: number; first: boolean }> {
  const [row] = await tx
    .insert(hackathonStages)
    .values({ playerId, stageId, clears: 1, firstClearAt: at })
    .onConflictDoUpdate({
      target: [hackathonStages.playerId, hackathonStages.stageId],
      set: { clears: sql`${hackathonStages.clears} + 1` },
    })
    .returning({ clears: hackathonStages.clears });
  const clears = row?.clears ?? 1;
  return { clears, first: clears === 1 };
}

export async function removeItems(tx: Tx, playerId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const removed = await tx
    .delete(hackathonItems)
    .where(and(eq(hackathonItems.playerId, playerId), inArray(hackathonItems.id, ids)))
    .returning({ id: hackathonItems.id });
  return removed.length;
}
