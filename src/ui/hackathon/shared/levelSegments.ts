import { hackathonContent } from '@/hackathon/content';
import { xpToNext } from '@/hackathon/engine';
import type { HackathonProfile, RunRewards } from '@/shared/hackathonApi';

export interface LevelSegment {
  level: number;
  /** Fill fractions, 0 to 1, of the bar of this level. */
  from: number;
  to: number;
}

/**
 * The level bar of a finished fight as a list of steps: where each level started and ended. The server only
 * answers with the profile after the fight, so the start is rebuilt from the XP gained and the XP each level needs.
 */
export function levelSegments(after: Pick<HackathonProfile, 'level' | 'xp' | 'xpToNext'>, rewards: Pick<RunRewards, 'xp' | 'levelsGained'>): LevelSegment[] {
  const need = (level: number) => xpToNext(level, hackathonContent);
  const startLevel = Math.max(1, after.level - rewards.levelsGained);
  // XP already inside the starting level: what the fight added is everything above it up to now.
  let carried = after.xp - rewards.xp;
  for (let level = startLevel; level < after.level; level += 1) carried += need(level);
  const startXp = Math.max(0, carried);

  const fraction = (xp: number, level: number) => {
    const total = need(level);
    return total > 0 ? Math.min(1, Math.max(0, xp / total)) : 1;
  };
  const segments: LevelSegment[] = [];
  for (let level = startLevel; level < after.level; level += 1) {
    segments.push({ level, from: segments.length === 0 ? fraction(startXp, level) : 0, to: 1 });
  }
  const capped = after.xpToNext === 0;
  segments.push({
    level: after.level,
    from: segments.length === 0 ? fraction(startXp, after.level) : 0,
    to: capped ? 1 : fraction(after.xp, after.level),
  });
  return segments;
}
