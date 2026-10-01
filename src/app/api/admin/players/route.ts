import { z } from 'zod';
import { listPlayers } from '@/server/admin/players';
import { requireAdmin } from '@/server/admin/guard';
import { currentPlayer } from '@/server/auth/context';
import { getDb } from '@/server/db/client';
import { validate } from '@/server/http/body';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search: z.string().max(60).default(''),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
});

export const GET = route(async (request: Request) => {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const query = validate(querySchema, {
    search: params.get('search') ?? undefined,
    page: params.get('page') ?? undefined,
  });
  const db = getDb();
  const self = await currentPlayer(db, request.headers);
  return jsonResponse(await listPlayers(db, { ...query, selfId: self?.player.id ?? null }));
});
