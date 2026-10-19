import { currentPlayer } from '@/server/auth/context';
import { PUBLIC_CACHE_CONTROL } from '@/server/community/cache';
import { donorsMe, getDonorsTop } from '@/server/community/donors';
import { getDb } from '@/server/db/client';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/**
 * The Centro Comunitário board: top 50 donors for everybody (cached like the other boards), plus the caller's own
 * row when they have a session. With a session the answer is about one player and is never put in a shared cache.
 */
export const GET = route(async (request: Request) => {
  const db = getDb();
  const top = await getDonorsTop(db);
  const authed = await currentPlayer(db, request.headers);
  if (!authed) return jsonResponse(top, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
  const me = await donorsMe(db, authed.player);
  return jsonResponse({ ...top, me }, { cookies: authed.cookies });
});
