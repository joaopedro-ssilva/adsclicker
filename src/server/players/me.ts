import type { MeResponse } from '@/shared/api';
import { currentPlayer } from '../auth/context';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { classroomBonusFor } from '../hackathon/classroom';
import type { HackathonDeps } from '../hackathon/deps';
import { sharedDeps } from '../hackathon/deps';
import { effectiveMultiplier } from './multiplier';
import { readProgressEpoch } from './progressEpoch';
import { toCloudInfo, toMe } from './summary';
import { getTagCatalog } from './tags';

/** GET /api/me: who this browser is. No session is not an error: the first sync creates one. */
export async function getMe(
  db: Db,
  headers: Headers,
  now: number = Date.now(),
  hackathon: HackathonDeps = sharedDeps(),
): Promise<{ body: MeResponse; cookies: string[] }> {
  const authed = await currentPlayer(db, headers, now);
  const eventMultiplier = await getEventMultiplier(db, now);
  if (!authed) return { body: { me: null, multiplier: eventMultiplier, cloud: null, epoch: await readProgressEpoch(db) }, cookies: [] };

  const { player } = authed;
  const bonus = await classroomBonusFor(db, player.id, hackathon);
  return {
    body: {
      me: toMe(player, await getTagCatalog(db, now)),
      multiplier: effectiveMultiplier(eventMultiplier, player.multiplier),
      ...(bonus ? { bonus } : {}),
      cloud: toCloudInfo(player),
      epoch: player.progressEpoch,
    },
    cookies: authed.cookies,
  };
}
