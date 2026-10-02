import { and, eq, gte, sql } from 'drizzle-orm';
import type { ItemInstance } from '@/hackathon/engine/types';
import { hackathonProfiles } from '../db/schema';
import { ApiFailure } from '../http/errors';
import type { HackathonDeps } from './deps';
import { MAX_COMMITS } from './limits';
import type { Tx } from './store';

/**
 * Takes Commits only if the balance covers them: the condition is part of the UPDATE, so even
 * two writers that slipped past the row lock could not drive the balance below zero (the table
 * also has a CHECK). Throws `forbidden` otherwise.
 */
export async function spendCommits(tx: Tx, playerId: string, cost: number): Promise<void> {
  const price = Math.floor(cost);
  if (!Number.isFinite(price) || price < 0 || price > MAX_COMMITS) throw new ApiFailure('internal');
  if (price === 0) return;
  const spent = await tx
    .update(hackathonProfiles)
    .set({ commits: sql`${hackathonProfiles.commits} - ${price}` })
    .where(and(eq(hackathonProfiles.playerId, playerId), gte(hackathonProfiles.commits, price)))
    .returning({ commits: hackathonProfiles.commits });
  if (spent.length === 0) throw new ApiFailure('forbidden', 'Commits insuficientes.');
}

/** Adds Commits, never past the cap. */
export async function earnCommits(tx: Tx, playerId: string, amount: number): Promise<void> {
  const gain = Math.max(0, Math.floor(amount));
  if (gain === 0) return;
  await tx
    .update(hackathonProfiles)
    .set({ commits: sql`least(${MAX_COMMITS}::bigint, ${hackathonProfiles.commits} + ${gain})` })
    .where(eq(hackathonProfiles.playerId, playerId));
}

/** The item that tops the player's collection by `itemScore`, or null without items. */
export function bestItemOf(items: ItemInstance[], deps: HackathonDeps): ItemInstance | null {
  let best: ItemInstance | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const score = deps.engine.itemScore(item, deps.content);
    if (score > bestScore || (score === bestScore && best !== null && item.id < best.id)) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/** Keeps the boards' "best item" column in step with the inventory (called whenever items change). */
export async function storeBestItem(tx: Tx, playerId: string, items: ItemInstance[], deps: HackathonDeps): Promise<void> {
  const best = bestItemOf(items, deps);
  await tx
    .update(hackathonProfiles)
    .set({ bestItemBase: best?.base ?? null, bestItemRarity: best?.rarity ?? null })
    .where(eq(hackathonProfiles.playerId, playerId));
}
