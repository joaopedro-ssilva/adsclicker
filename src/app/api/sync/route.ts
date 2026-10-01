import { readSessionToken } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { SYNC_BODY_BYTES, parseBody } from '@/server/http/body';
import { clientIp } from '@/server/http/ip';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { syncPlayer } from '@/server/players/sync';
import { syncRequestSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const body = await parseBody(request, syncRequestSchema, SYNC_BODY_BYTES);
  const { body: result, cookies } = await syncPlayer(getDb(), {
    request: body,
    token: readSessionToken(request.headers),
    ip: clientIp(request.headers),
  });
  return jsonResponse(result, { cookies });
});
