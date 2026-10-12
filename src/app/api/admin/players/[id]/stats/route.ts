import { requireAdmin } from '@/server/admin/guard';
import { playerStats } from '@/server/admin/playerStats';
import { getDb } from '@/server/db/client';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Everything about one player: the account and, when there is a cloud save, the progress read from it. */
export const GET = route(async (_request: Request, context: RouteContext<'/api/admin/players/[id]/stats'>) => {
  await requireAdmin();
  const { id } = await context.params;
  return jsonResponse(await playerStats(getDb(), id));
});
