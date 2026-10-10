import { z } from 'zod';
import { requireAdmin } from '@/server/admin/guard';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { pruneLogs } from '@/server/logs/log';
import { queryLogs } from '@/server/logs/query';
import { LOG_LEVELS, LOG_RANGES } from '@/shared/api';

export const dynamic = 'force-dynamic';

const logsQuerySchema = z.object({
  range: z.enum(LOG_RANGES).default('1h'),
  level: z.enum(LOG_LEVELS).optional(),
  kind: z.string().max(60).optional(),
  q: z.string().max(80).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** The server event log, newest first. Opening it also prunes old entries (retention in docs/BACKEND.md). */
export const GET = route(async (request: Request) => {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const get = (name: string) => params.get(name) || undefined;
  const query = validate(logsQuerySchema, {
    range: get('range'),
    level: get('level'),
    kind: get('kind'),
    q: get('q'),
    before: get('before'),
    limit: get('limit'),
  });
  const db = getDb();
  // Only the first page prunes; "load more" must stay light.
  if (query.before === undefined) await pruneLogs(db);
  return jsonResponse(await queryLogs(db, query));
});
