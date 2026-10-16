import { z } from 'zod';
import { PUBLIC_CACHE_CONTROL } from '@/server/community/cache';
import { getLabProfile } from '@/server/community/labProfile';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { clientIp, hashIp } from '@/server/http/ip';
import { consume } from '@/server/http/rateLimit';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

const MINUTE = 60_000;
/** Per IP, like the community card: plenty for browsing the ranking, too few to crawl every nickname. */
const LAB_PROFILE_RATE = { scope: 'lab-profile', limit: 60, windowMs: MINUTE };

/** The public lab profile of a ranked player: what they wear in the lab, their records and their lab numbers. */
export const GET = route(async (request: Request) => {
  const nickname = validate(z.string().trim().min(1).max(40), new URL(request.url).searchParams.get('nickname') ?? undefined);
  const db = getDb();
  await consume(db, LAB_PROFILE_RATE, hashIp(clientIp(request.headers)));
  const body = await getLabProfile(db, nickname);
  return jsonResponse(body, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
});
