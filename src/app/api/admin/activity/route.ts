import { z } from 'zod';
import { requireAdmin } from '@/server/admin/guard';
import { pruneFeed } from '@/server/community/community';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { queryActivity } from '@/server/logs/query';
import { LOG_RANGES } from '@/shared/api';

export const dynamic = 'force-dynamic';

const activityQuerySchema = z.object({
  range: z.enum(LOG_RANGES).default('1h'),
  kind: z.string().max(40).optional(),
  q: z.string().max(40).optional(),
  before: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** Every event of the class feed (the game shows only the latest 30), newest first. */
export const GET = route(async (request: Request) => {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const get = (name: string) => params.get(name) || undefined;
  const query = validate(activityQuerySchema, {
    range: get('range'),
    kind: get('kind'),
    q: get('q'),
    before: get('before'),
    limit: get('limit'),
  });
  const db = getDb();
  if (query.before === undefined) await pruneFeed(db);
  return jsonResponse(await queryActivity(db, query));
});
