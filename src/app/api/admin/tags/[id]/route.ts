import { requireAdmin } from '@/server/admin/guard';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { deleteTag, updateTag } from '@/server/players/tags';
import { adminTagPatchSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

/** Edits a tag (name, description, colour, visibility, single holder). */
export const POST = route(async (request: Request, context: RouteContext<'/api/admin/tags/[id]'>) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { id } = await context.params;
  const patch = await parseBody(request, adminTagPatchSchema);
  return jsonResponse(await updateTag(getDb(), id, patch));
});

/** Deletes a tag and takes it from every player who holds it. */
export const DELETE = route(async (request: Request, context: RouteContext<'/api/admin/tags/[id]'>) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { id } = await context.params;
  return jsonResponse(await deleteTag(getDb(), id));
});
