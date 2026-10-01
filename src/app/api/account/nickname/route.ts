import { requireSession } from '@/server/auth/context';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { setNickname } from '@/server/players/account';
import { nicknameRequestSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const body = await parseBody(request, nicknameRequestSchema);
  const db = getDb();
  const authed = await requireSession(db, request.headers);
  return jsonResponse(await setNickname(db, authed, body), { cookies: authed.cookies });
});
