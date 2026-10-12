import { requireAdmin } from '@/server/admin/guard';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { createTag, listAdminTags } from '@/server/players/tags';
import { adminTagCreateSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

/** The tag catalogue, with how many players hold each one. */
export const GET = route(async () => {
  await requireAdmin();
  return jsonResponse(await listAdminTags(getDb()));
});

/** Creates a tag. */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await requireAdmin();
  const input = await parseBody(request, adminTagCreateSchema);
  return jsonResponse(await createTag(getDb(), input));
});
