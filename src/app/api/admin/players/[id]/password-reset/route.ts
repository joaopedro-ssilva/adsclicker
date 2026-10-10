import { requireAdmin } from '@/server/admin/guard';
import { resetPlayerPassword } from '@/server/admin/players';
import { currentPlayer } from '@/server/auth/context';
import { getDb } from '@/server/db/client';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request, context: RouteContext<'/api/admin/players/[id]/password-reset'>) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { id } = await context.params;
  const db = getDb();
  const self = await currentPlayer(db, request.headers);
  return jsonResponse(await resetPlayerPassword(db, id, self?.player.id ?? null));
});
