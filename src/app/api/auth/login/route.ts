import { login } from '@/server/auth/login';
import { readSessionToken } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { clientIp } from '@/server/http/ip';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { loginRequestSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const body = await parseBody(request, loginRequestSchema);
  const { body: result, cookies } = await login(getDb(), body, {
    ip: clientIp(request.headers),
    currentToken: readSessionToken(request.headers),
  });
  return jsonResponse(result, { cookies });
});
