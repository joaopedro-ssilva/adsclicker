import { requireAdmin } from '@/server/admin/guard';
import { getDb } from '@/server/db/client';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { grantTurmaZeroToAll, turmaZeroPreview } from '@/server/players/tags';

export const dynamic = 'force-dynamic';

/** How many accounts the bulk grant would change, to show before confirming. */
export const GET = route(async () => {
  await requireAdmin();
  return jsonResponse(await turmaZeroPreview(getDb()));
});

/** Gives "Turma Zero" to every account with a nickname that synced at least once. */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await requireAdmin();
  return jsonResponse(await grantTurmaZeroToAll(getDb()));
});
