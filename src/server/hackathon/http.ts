import type { z } from 'zod';
import { requireSession } from '../auth/context';
import { getDb } from '../db/client';
import { SMALL_BODY_BYTES, parseBody } from '../http/body';
import { assertSameOrigin } from '../http/origin';
import { consume } from '../http/rateLimit';
import type { RateRule } from '../http/rateLimit';
import { jsonResponse } from '../http/respond';
import { route } from '../http/route';
import type { HackathonContext } from './context';
import { sharedDeps } from './deps';

const MINUTE = 60_000;

/** 2000 actions of up to ~80 bytes each. */
export const FINISH_BODY_BYTES = 200_000;

/** Per player. A stage takes a minute or more to play, so a few starts and finishes a minute is plenty. */
export const HACKATHON_RATES = {
  read: { scope: 'hk-read', limit: 60, windowMs: MINUTE },
  manage: { scope: 'hk-manage', limit: 60, windowMs: MINUTE },
  runStart: { scope: 'hk-start', limit: 6, windowMs: MINUTE },
  runFinish: { scope: 'hk-finish', limit: 6, windowMs: MINUTE },
} as const satisfies Record<string, RateRule>;

async function contextOf(request: Request, rule: RateRule) {
  const db = getDb();
  const authed = await requireSession(db, request.headers);
  await consume(db, rule, authed.player.id);
  const ctx: HackathonContext = { db, player: authed.player, deps: sharedDeps(), now: Date.now() };
  return { ctx, cookies: authed.cookies };
}

/** A GET route: session, rate limit, then the service. */
export function hackathonGet<R>(rule: RateRule, service: (ctx: HackathonContext) => Promise<R>) {
  return route(async (request: Request) => {
    const { ctx, cookies } = await contextOf(request, rule);
    return jsonResponse(await service(ctx), { cookies });
  });
}

/** A POST route: same-origin, validated body, session, rate limit, then the service. */
export function hackathonPost<S extends z.ZodType, R>(
  schema: S,
  rule: RateRule,
  service: (ctx: HackathonContext, body: z.infer<S>) => Promise<R>,
  maxBytes: number = SMALL_BODY_BYTES,
) {
  return route(async (request: Request) => {
    assertSameOrigin(request);
    const body = await parseBody(request, schema, maxBytes);
    const { ctx, cookies } = await contextOf(request, rule);
    return jsonResponse(await service(ctx, body), { cookies });
  });
}
