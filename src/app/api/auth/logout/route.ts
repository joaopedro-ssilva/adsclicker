import { logout } from '@/server/auth/login';
import { readSessionToken } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const { cookies } = await logout(getDb(), readSessionToken(request.headers));
  return jsonResponse({ ok: true }, { cookies });
});
