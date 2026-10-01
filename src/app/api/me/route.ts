import { getDb } from '@/server/db/client';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { getMe } from '@/server/players/me';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  const { body, cookies } = await getMe(getDb(), request.headers);
  return jsonResponse(body, { cookies });
});
