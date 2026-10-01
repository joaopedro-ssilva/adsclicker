import type { MeResponse } from '@/shared/api';
import { currentPlayer } from '../auth/context';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { effectiveMultiplier } from './multiplier';
import { toCloudInfo, toMe } from './summary';

/** GET /api/me: who this browser is. No session is not an error: the first sync creates one. */
export async function getMe(db: Db, headers: Headers, now: number = Date.now()): Promise<{ body: MeResponse; cookies: string[] }> {
  const authed = await currentPlayer(db, headers, now);
  const eventMultiplier = await getEventMultiplier(db, now);
  if (!authed) return { body: { me: null, multiplier: eventMultiplier, cloud: null }, cookies: [] };

  const { player } = authed;
  return {
    body: { me: toMe(player), multiplier: effectiveMultiplier(eventMultiplier, player.multiplier), cloud: toCloudInfo(player) },
    cookies: authed.cookies,
  };
}
