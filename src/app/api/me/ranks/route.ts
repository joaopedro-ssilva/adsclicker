import { requireSession } from '@/server/auth/context';
import { getRanks } from '@/server/community/leaderboard';
import { getDb } from '@/server/db/client';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  const db = getDb();
  const authed = await requireSession(db, request.headers);
  return jsonResponse(await getRanks(db, authed.player), { cookies: authed.cookies });
});
