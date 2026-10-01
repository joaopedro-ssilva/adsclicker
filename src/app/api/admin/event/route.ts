import { requireAdmin } from '@/server/admin/guard';
import { setEventMultiplier } from '@/server/config/eventMultiplier';
import { getDb } from '@/server/db/client';
import { parseBody } from '@/server/http/body';
import { assertSameOrigin } from '@/server/http/origin';
import { jsonResponse } from '@/server/http/respond';
import { route } from '@/server/http/route';
import { adminEventRequestSchema } from '@/shared/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await requireAdmin();
  const { multiplier } = await parseBody(request, adminEventRequestSchema);
  await setEventMultiplier(getDb(), multiplier);
  return jsonResponse({ ok: true });
});
