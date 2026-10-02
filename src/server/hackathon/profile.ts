import type { CreateProfileRequest, ProfileOnlyResponse, ProfileResponse } from '@/shared/hackathonApi';
import { hackathonProfiles } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { profileIn } from './context';
import type { HackathonContext } from './context';
import { assertReady } from './deps';
import { loadSave } from './store';
import { hackathonLock } from './unlock';
import { loadProfileData, toProfile } from './view';
import { safeWhole } from './limits';

/** GET /api/hackathon/profile */
export async function getProfile(ctx: HackathonContext): Promise<ProfileResponse> {
  assertReady(ctx.deps);
  const data = await loadProfileData(ctx.db, ctx.player.id, ctx.now);
  const save = data ? data.save : await loadSave(ctx.db, ctx.player.id, ctx.now);
  const lockReason = hackathonLock(save);
  return {
    unlocked: lockReason === null,
    lockReason,
    profile: data ? toProfile(data, ctx.deps, ctx.now) : null,
  };
}

/**
 * POST /api/hackathon/profile: creates the student, or changes the head of the existing one.
 * One upsert, so two simultaneous creations cannot make two students.
 */
export async function saveProfile(ctx: HackathonContext, request: CreateProfileRequest): Promise<ProfileOnlyResponse> {
  assertReady(ctx.deps);
  const { content } = ctx.deps;
  if (!content.heads.some((head) => head.id === request.head)) throw new ApiFailure('invalid', 'Escolha uma das cabeças disponíveis.');

  const save = await loadSave(ctx.db, ctx.player.id, ctx.now);
  const lockReason = hackathonLock(save);
  if (lockReason !== null) throw new ApiFailure('forbidden', lockReason);

  return ctx.db.transaction(async (tx) => {
    await tx
      .insert(hackathonProfiles)
      .values({
        playerId: ctx.player.id,
        head: request.head,
        cafeCount: content.config.cafe.max,
        cafeAt: new Date(ctx.now),
        // What happened in the classroom before the student existed pays nothing.
        cafesBoughtCredited: safeWhole(save?.counters.cafesBought ?? 0),
        graduationsCredited: safeWhole(save?.counters.graduations ?? 0),
      })
      .onConflictDoUpdate({ target: hackathonProfiles.playerId, set: { head: request.head } });
    return { profile: await profileIn(tx, ctx) };
  });
}
