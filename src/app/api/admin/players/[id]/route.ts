import { requireAdmin } from '@/server/admin/guard';
import { patchPlayer } from '@/server/admin/players';
import { currentPlayer } from '@/server/auth/context';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { adminPlayerPatchSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request, context: RouteContext<'/api/admin/players/[id]'>) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { id } = await context.params;
  const patch = await parseBody(request, adminPlayerPatchSchema);
  const db = getDb();
  const self = await currentPlayer(db, request.headers);
  return jsonResponse(await patchPlayer(db, id, patch, self?.player.id ?? null));
});
