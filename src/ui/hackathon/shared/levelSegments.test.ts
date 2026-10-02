import { describe, expect, it } from 'vitest';
import { hackathonContent } from '@/hackathon/content';
import { xpToNext } from '@/hackathon/engine';
import { levelSegments } from './levelSegments';

const need = (level: number) => xpToNext(level, hackathonContent);

describe('levelSegments', () => {
  it('is one segment from where the bar was to where it is, without a level up', () => {
    const [segment, ...rest] = levelSegments({ level: 2, xp: 50, xpToNext: need(2) }, { xp: 30, levelsGained: 0 });
    expect(rest).toHaveLength(0);
    expect(segment?.level).toBe(2);
    expect(segment?.from).toBeCloseTo(20 / need(2));
    expect(segment?.to).toBeCloseTo(50 / need(2));
  });

  it('fills the old level, then starts the next one from empty', () => {
    // Level 1 with 90 XP, wins 40: 10 left over in level 2.
    const segments = levelSegments({ level: 2, xp: 30, xpToNext: need(2) }, { xp: need(1) - 90 + 30, levelsGained: 1 });
    expect(segments.map((segment) => segment.level)).toEqual([1, 2]);
    expect(segments[0]?.from).toBeCloseTo(90 / need(1));
    expect(segments[0]?.to).toBe(1);
    expect(segments[1]?.from).toBe(0);
    expect(segments[1]?.to).toBeCloseTo(30 / need(2));
  });

  it('keeps the bar full at the level cap', () => {
    const last = levelSegments({ level: 10, xp: need(10), xpToNext: 0 }, { xp: 20, levelsGained: 0 }).at(-1);
    expect(last?.to).toBe(1);
  });
});
