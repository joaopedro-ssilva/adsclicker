import type { Db } from '../db/client';
import { players } from '../db/schema';
import type { PlayerRow } from '../db/schema';
import { hashIp } from '../http/ip';
import { RATE_RULES, consume } from '../http/rateLimit';
import { createSession, sweepExpiredSessionsLater } from './session';

/**
 * Creates an anonymous player and its session, limited per IP. Called by the first sync of a
 * browser without a session: nobody fills a form to play.
 */
export async function createGuest(db: Db, ip: string, now: number = Date.now()): Promise<{ player: PlayerRow; token: string }> {
  await consume(db, RATE_RULES.guest, hashIp(ip), now);
  const created = await db.transaction(async (tx) => {
    const [player] = await tx
      .insert(players)
      .values({ createdAt: new Date(now), lastSeenAt: new Date(now) })
      .returning();
    if (!player) throw new Error('guest insert returned no row');
    const token = await createSession(tx, player.id, now);
    return { player, token };
  });
  sweepExpiredSessionsLater(db, now);
  return created;
}
