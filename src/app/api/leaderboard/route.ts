import { PUBLIC_CACHE_CONTROL } from '@/server/community/cache';
import { getLeaderboard } from '@/server/community/leaderboard';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { boardSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  const board = validate(boardSchema.default('coins'), new URL(request.url).searchParams.get('board') ?? undefined);
  const body = await getLeaderboard(getDb(), board);
  return jsonResponse(body, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
});
