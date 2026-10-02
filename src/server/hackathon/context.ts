import type { HackathonProfile } from '@/shared/hackathonApi';
import type { Db } from '../db/client';
import { ApiFailure } from '../http/errors';
import type { PlayerCore } from '../players/summary';
import type { HackathonDeps } from './deps';
import { assertReady } from './deps';
import { lockProfile, readProfileRow } from './store';
import type { ProfileRow, Tx } from './store';
import { loadProfileDataFor, toProfile } from './view';

/** What every service call needs: the database, who is asking, the engine and content, and the clock. */
export interface HackathonContext {
  db: Db;
  player: PlayerCore;
  deps: HackathonDeps;
  now: number;
}

export const NO_PROFILE_MESSAGE = 'Crie seu aluno antes de jogar o Hackathon.';

/** The profile as the response shape, read inside the transaction that just changed it. */
export async function profileIn(tx: Tx, ctx: HackathonContext): Promise<HackathonProfile> {
  const row = await readProfileRow(tx, ctx.player.id);
  if (!row) throw new ApiFailure('not_found', NO_PROFILE_MESSAGE);
  return toProfile(await loadProfileDataFor(tx, row, ctx.now), ctx.deps, ctx.now);
}

/**
 * Runs `work` in a transaction that holds the player's profile row, so a player's writes never
 * interleave, and answers with the profile as it is afterwards.
 */
export async function withProfile(ctx: HackathonContext, work: (tx: Tx, row: ProfileRow) => Promise<void>): Promise<HackathonProfile> {
  assertReady(ctx.deps);
  return ctx.db.transaction(async (tx) => {
    const row = await lockProfile(tx, ctx.player.id);
    if (!row) throw new ApiFailure('not_found', NO_PROFILE_MESSAGE);
    await work(tx, row);
    return profileIn(tx, ctx);
  });
}
