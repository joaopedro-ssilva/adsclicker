import { eq } from 'drizzle-orm';
import type { CloudBonusPayload } from '@/shared/api';
import type { Db } from '../db/client';
import { describeError } from '../http/route';
import { hackathonProfiles } from '../db/schema';
import { addCafe, refillCafe, regenCafe } from './cafe';
import { hasPendingCredit, planClassroomCredit } from './classroomPlan';
import type { CreditCounters } from './classroomPlan';
import { dateKeyOf } from './dates';
import type { HackathonDeps } from './deps';
import { isReady } from './deps';
import { MAX_XP } from './limits';
import { lockProfile, readProfileRow } from './store';
import type { ProfileRow } from './store';
import { asCargo, mentorLevels } from './view';

/**
 * The permanent classroom bonus of a student (cargo and mentors), computed by the engine from the
 * stored values. Undefined while the Hackathon is not ready: the classroom then plays without it.
 */
export function bonusOf(row: Pick<ProfileRow, 'cargo' | 'mentors'>, deps: HackathonDeps): CloudBonusPayload | undefined {
  if (!isReady(deps)) return undefined;
  try {
    const bonus = deps.engine.classroomBonus({ cargo: asCargo(row.cargo, deps), mentors: mentorLevels(row) }, deps.content);
    return { cargo: bonus.cargo, mentors: bonus.mentors };
  } catch (error) {
    console.error(`[hackathon] classroom bonus failed: ${describeError(error)}`);
    return undefined;
  }
}

/** The `bonus` of /api/me and login: one primary-key read, nothing for a player without a student. */
export async function classroomBonusFor(db: Db, playerId: string, deps: HackathonDeps): Promise<CloudBonusPayload | undefined> {
  const row = await readProfileRow(db, playerId);
  return row ? bonusOf(row, deps) : undefined;
}

/**
 * Pays the classroom's gifts after an accepted sync (see classroomPlan.ts for the rules). Never
 * throws: the sync has already been stored, and anything left unpaid stays pending in the counters
 * for the next sync.
 */
export async function creditClassroom(
  db: Db,
  row: ProfileRow | null,
  counters: CreditCounters,
  deps: HackathonDeps,
  now: number,
): Promise<void> {
  if (!row || !hasPendingCredit(counters, row) || !isReady(deps)) return;
  const { content, engine } = deps;
  // Purchases waiting for room do not justify a transaction on every sync while the bar is full.
  const room = content.config.cafe.max - regenCafe({ count: row.cafeCount, at: row.cafeAt.getTime() }, now, content.config.cafe).count;
  const graduationsPending = Math.floor(counters.graduations) > row.graduationsCredited;
  if (room <= 0 && !graduationsPending) return;
  try {
    await db.transaction(async (tx) => {
      const locked = await lockProfile(tx, row.playerId);
      if (!locked) return;
      const dateKey = dateKeyOf(now);
      const cafe = regenCafe({ count: locked.cafeCount, at: locked.cafeAt.getTime() }, now, content.config.cafe);
      const plan = planClassroomCredit({
        counters,
        profile: locked,
        dateKey,
        cafeRoom: content.config.cafe.max - cafe.count,
        caps: { cafesPerDay: content.config.cafe.boughtPerDayCap, graduationsPerDay: content.config.graduation.perDayCap },
      });

      let next = addCafe(cafe, plan.cafes, now, content.config.cafe).state;
      let { level, xp } = locked;
      if (plan.graduations > 0) {
        next = refillCafe(now, content.config.cafe);
        const progress = engine.applyXp(
          { cargo: asCargo(locked.cargo, deps), level, xp },
          content.config.graduation.xp * plan.graduations,
          content,
        );
        level = progress.level;
        xp = Math.min(MAX_XP, progress.xp);
      }

      await tx
        .update(hackathonProfiles)
        .set({
          cafeCount: next.count,
          cafeAt: new Date(next.at),
          level,
          xp,
          cafesBoughtCredited: plan.cafesBoughtCredited,
          graduationsCredited: plan.graduationsCredited,
          creditDay: plan.creditDay,
          cafesCreditedToday: plan.cafesCreditedToday,
          graduationsCreditedToday: plan.graduationsCreditedToday,
        })
        .where(eq(hackathonProfiles.playerId, locked.playerId));
    });
  } catch (error) {
    console.error(`[hackathon] classroom credit failed: ${describeError(error)}`);
  }
}
