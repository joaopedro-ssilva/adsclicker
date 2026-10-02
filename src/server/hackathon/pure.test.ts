import { describe, expect, it } from 'vitest';
import type { ItemInstance } from '@/hackathon/engine/types';
import { addCafe, cafeNextAt, refillCafe, regenCafe, spendCafe } from './cafe';
import { hasPendingCredit, planClassroomCredit } from './classroomPlan';
import type { CreditProfile } from './classroomPlan';
import { dateKeyOf } from './dates';
import { createFake, fixtureContent } from './fixtures';
import { baseRewards, fitInventory, nextCargo, promotionFor } from './rewards';
import { LOCK_NO_B2, LOCK_NO_SAVE, hackathonLock, stageLock, unlockedMentors, wasHired } from './unlock';
import { bestItemOf } from './balance';

const MIN = 60_000;
const cafeConfig = { max: 5, regenMinutes: 15 };

describe('Café regeneration', () => {
  const T = Date.UTC(2026, 9, 2, 12, 0, 0);

  it('gives +1 per full interval and keeps the leftover time', () => {
    const state = regenCafe({ count: 1, at: T }, T + 40 * MIN, cafeConfig);
    expect(state).toEqual({ count: 3, at: T + 30 * MIN });
    expect(cafeNextAt(state, cafeConfig)).toBe(T + 45 * MIN);
  });

  it('stops at the maximum and restarts the clock from the moment it is spent', () => {
    const full = regenCafe({ count: 4, at: T }, T + 600 * MIN, cafeConfig);
    expect(full).toEqual({ count: 5, at: T + 600 * MIN });
    expect(cafeNextAt(full, cafeConfig)).toBeNull();
    const spent = spendCafe(full, T + 600 * MIN, cafeConfig);
    expect(spent).toEqual({ count: 4, at: T + 600 * MIN });
    expect(cafeNextAt(spent!, cafeConfig)).toBe(T + 615 * MIN);
  });

  it('refuses to spend when empty and never goes below zero', () => {
    expect(spendCafe({ count: 0, at: T }, T + 14 * MIN, cafeConfig)).toBeNull();
    expect(spendCafe({ count: 0, at: T }, T + 15 * MIN, cafeConfig)).toEqual({ count: 0, at: T + 15 * MIN });
    expect(regenCafe({ count: -3, at: T }, T, cafeConfig).count).toBe(0);
  });

  it('survives a clock that went backwards', () => {
    expect(regenCafe({ count: 2, at: T }, T - 5 * MIN, cafeConfig)).toEqual({ count: 2, at: T - 5 * MIN });
  });

  it('adds only what fits and refills on demand', () => {
    const result = addCafe({ count: 3, at: T }, 10, T, cafeConfig);
    expect(result.added).toBe(2);
    expect(result.state).toEqual({ count: 5, at: T });
    expect(addCafe({ count: 5, at: T }, 1, T, cafeConfig).added).toBe(0);
    expect(refillCafe(T, cafeConfig)).toEqual({ count: 5, at: T });
  });
});

describe('classroom credit', () => {
  const caps = { cafesPerDay: 12, graduationsPerDay: 3 };
  const fresh: CreditProfile = {
    cafesBoughtCredited: 0,
    graduationsCredited: 0,
    creditDay: '2026-10-02',
    cafesCreditedToday: 0,
    graduationsCreditedToday: 0,
  };
  const plan = (counters: { cafesBought: number; graduations: number }, profile: CreditProfile = fresh, room = 5, dateKey = '2026-10-02') =>
    planClassroomCredit({ counters, profile, dateKey, cafeRoom: room, caps });

  it('credits the growth of the purchases counter', () => {
    expect(plan({ cafesBought: 3, graduations: 0 })).toMatchObject({ cafes: 3, cafesBoughtCredited: 3, cafesCreditedToday: 3 });
  });

  it('never passes the room left in the bar and keeps the rest pending', () => {
    const first = plan({ cafesBought: 4, graduations: 0 }, fresh, 2);
    expect(first).toMatchObject({ cafes: 2, cafesBoughtCredited: 2 });
    const later = plan({ cafesBought: 4, graduations: 0 }, first, 5);
    expect(later).toMatchObject({ cafes: 2, cafesBoughtCredited: 4 });
  });

  it('stops at the daily cap, and the day rolling over resets it', () => {
    const capped = plan({ cafesBought: 20, graduations: 0 }, fresh, 99);
    expect(capped.cafes).toBe(12);
    expect(plan({ cafesBought: 20, graduations: 0 }, capped, 99).cafes).toBe(0);
    expect(plan({ cafesBought: 20, graduations: 0 }, capped, 99, '2026-10-03')).toMatchObject({ cafes: 8, cafesCreditedToday: 8 });
  });

  it('pays graduations up to the cap and discards the excess', () => {
    const paid = plan({ cafesBought: 0, graduations: 5 });
    expect(paid).toMatchObject({ graduations: 3, graduationsCredited: 5, graduationsCreditedToday: 3 });
    expect(plan({ cafesBought: 0, graduations: 6 }, paid).graduations).toBe(0);
  });

  it('credits nothing when the counters went backwards, and does not lower what was credited', () => {
    const profile = { ...fresh, cafesBoughtCredited: 8, graduationsCredited: 4 };
    const result = plan({ cafesBought: 2, graduations: 1 }, profile);
    expect(result).toMatchObject({ cafes: 0, graduations: 0, cafesBoughtCredited: 8, graduationsCredited: 4 });
    expect(hasPendingCredit({ cafesBought: 2, graduations: 1 }, profile)).toBe(false);
    expect(hasPendingCredit({ cafesBought: 9, graduations: 1 }, profile)).toBe(true);
  });

  it('ignores garbage counters', () => {
    expect(plan({ cafesBought: Number.NaN, graduations: Number.POSITIVE_INFINITY })).toMatchObject({ cafes: 0 });
  });
});

describe('unlock rules', () => {
  const save = (hired: string[], achievements: string[] = []) =>
    ({
      hired: Object.fromEntries(
        ['edecio', 'gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo', 'pablo'].map((id) => [id, hired.includes(id)]),
      ),
      achievements: Object.fromEntries(achievements.map((id) => [id, 1])),
    }) as Parameters<typeof wasHired>[0];

  it('opens with Bruna B2 hired now or ever', () => {
    expect(hackathonLock(null)).toBe(LOCK_NO_SAVE);
    expect(hackathonLock(save(['edecio', 'gladimir']))).toBe(LOCK_NO_B2);
    expect(hackathonLock(save(['edecio', 'b2']))).toBeNull();
    expect(hackathonLock(save(['edecio'], ['hire-b2']))).toBeNull();
  });

  it('unlocks the mentors of the professors hired once, and Edécio always', () => {
    const mentors = unlockedMentors(save([], ['hire-wagner']));
    expect(mentors).toMatchObject({ edecio: true, wagner: true, b2: false });
    expect(unlockedMentors(null).edecio).toBe(true);
  });

  it('locks a stage by level and by the previous win', () => {
    const [s1, s2] = fixtureContent.stages;
    expect(stageLock(s1!, 1, {}, fixtureContent)).toBeNull();
    expect(stageLock(s2!, 1, { s1: 1 }, fixtureContent)).toMatch(/nível 2/);
    expect(stageLock(s2!, 2, {}, fixtureContent)).toMatch(/Fase s1/);
    expect(stageLock(s2!, 2, { s1: 1 }, fixtureContent)).toBeNull();
  });
});

describe('reward assembly', () => {
  const fake = createFake();
  const resolved = fake.deps.engine.resolveStage('s1', '2026-10-02', fixtureContent)!;
  const build = fake.deps.engine.computeBuild(
    { cargo: 'estudante', level: 1, skillNodes: {}, mentors: {}, equipped: {}, activeSkills: [] },
    fixtureContent,
  );
  const withMeta = (xpGain: number, commitsGain: number) => ({ ...build, meta: { ...build.meta, xpGain, commitsGain } });

  it('pays the stage on a win, grown by the build, with the first-clear multiplier on Commits only', () => {
    expect(baseRewards({ won: true, stage: resolved, build, firstClear: false, content: fixtureContent })).toEqual({
      xp: 100,
      commits: 40,
    });
    expect(baseRewards({ won: true, stage: resolved, build: withMeta(50, 25), firstClear: true, content: fixtureContent })).toEqual({
      xp: 150,
      commits: 100,
    });
  });

  it('keeps the defeat share of the XP and nothing else', () => {
    expect(baseRewards({ won: false, stage: resolved, build: withMeta(50, 50), firstClear: true, content: fixtureContent })).toEqual({
      xp: 45,
      commits: 0,
    });
  });

  const item = (id: string, rarity: ItemInstance['rarity']): ItemInstance => ({
    id,
    base: 'tool-a',
    rarity,
    level: 1,
    affixes: [],
    quality: 10,
    rerolls: 0,
    createdAt: 0,
  });

  it('recycles into Commits what does not fit in the inventory', () => {
    const drops = [item('a', 'comum'), item('b', 'raro'), item('c', 'lendario')];
    const value = (entry: ItemInstance) => fake.deps.engine.recycleValue(entry, fixtureContent);
    const fit = fitInventory(drops, 38, 40, value);
    expect(fit.kept.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(fit.recycled.map((entry) => entry.id)).toEqual(['c']);
    expect(fit.recycledCommits).toBe(50);
    expect(fitInventory(drops, 40, 40, value).kept).toEqual([]);
    expect(fitInventory(drops, 99, 40, value).recycledCommits).toBe(10 + 30 + 50);
  });

  it('promotes only on the first win of the promotion stage', () => {
    expect(nextCargo(fixtureContent, 'estudante')).toBe('estagiario');
    expect(nextCargo(fixtureContent, 'estagiario')).toBeNull();
    expect(promotionFor(fixtureContent, 'estudante', 'boss', true, true)).toBe('estagiario');
    expect(promotionFor(fixtureContent, 'estudante', 'boss', true, false)).toBeNull();
    expect(promotionFor(fixtureContent, 'estudante', 'boss', false, true)).toBeNull();
    expect(promotionFor(fixtureContent, 'estudante', 's1', true, true)).toBeNull();
    expect(promotionFor(fixtureContent, 'estagiario', 'boss', true, true)).toBeNull();
  });

  it('picks the best item by score, ties by id', () => {
    const best = bestItemOf([item('a', 'raro'), item('b', 'lendario'), item('c', 'epico')], fake.deps);
    expect(best?.id).toBe('b');
    expect(bestItemOf([], fake.deps)).toBeNull();
  });
});

describe('server day', () => {
  it('follows America/Sao_Paulo, not UTC', () => {
    expect(dateKeyOf(Date.UTC(2026, 9, 2, 2, 59))).toBe('2026-10-01');
    expect(dateKeyOf(Date.UTC(2026, 9, 2, 3, 0))).toBe('2026-10-02');
  });
});
