import { PUBLIC_CACHE_CONTROL } from '@/server/community/cache';
import { getCommunity } from '@/server/community/community';
import { getDb } from '@/server/db/client';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const body = await getCommunity(getDb());
  return jsonResponse(body, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
});
