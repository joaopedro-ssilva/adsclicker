import { requireAdmin } from '@/server/admin/guard';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { previewLaunchReset, resetForLaunch } from '@/server/players/launchReset';
import { adminLaunchResetRequestSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

/** What the reset would touch right now. */
export const GET = route(async () => {
  await requireAdmin();
  return jsonResponse(await previewLaunchReset(getDb()));
});

/** The launch reset. Needs the typed confirmation phrase; see docs/BACKEND.md. */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { phrase } = await parseBody(request, adminLaunchResetRequestSchema);
  return jsonResponse(await resetForLaunch(getDb(), phrase));
});
