import { currentPlayer } from '@/server/auth/context';
import { PUBLIC_CACHE_CONTROL } from '@/server/community/cache';
import { getLabLeaderboardTop, labBoardMe } from '@/server/community/labLeaderboard';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { labBoardSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

/**
 * The Laboratório boards: top 50 for everybody (cached like the other boards), plus the caller's own row when they have a
 * session. With a session the answer is about one player and is never put in a shared cache.
 */
export const GET = route(async (request: Request) => {
  const board = validate(labBoardSchema.default('phase'), new URL(request.url).searchParams.get('board') ?? undefined);
  const db = getDb();
  const top = await getLabLeaderboardTop(db, board);
  const authed = await currentPlayer(db, request.headers);
  if (!authed) return jsonResponse(top, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
  const me = await labBoardMe(db, board, authed.player);
  return jsonResponse({ ...top, me }, { cookies: authed.cookies });
});
