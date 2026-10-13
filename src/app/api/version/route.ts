import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** GET /api/version: the build that is live now. Open tabs compare it with the one they were loaded with. */
export const GET = route(async () =>
  jsonResponse({ build: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' }, { headers: { 'cache-control': 'no-store' } }),
);
