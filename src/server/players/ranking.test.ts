import { afterEach, describe, expect, it } from 'vitest';
import { flaggedAreRanked } from './ranking';
import { isRanked, toMe } from './summary';

const flaggedPlayer = { id: 'p1', nickname: 'Suspeito', passwordHash: null, flagged: true, banned: false, testAccount: false };

describe('ranking of flagged players', () => {
  const original = process.env.RANK_FLAGGED_PLAYERS;
  afterEach(() => {
    process.env.RANK_FLAGGED_PLAYERS = original;
  });

  it('keeps flagged players off the boards by default', () => {
    delete process.env.RANK_FLAGGED_PLAYERS;
    expect(flaggedAreRanked()).toBe(false);
    expect(isRanked(flaggedPlayer)).toBe(false);
    expect(toMe(flaggedPlayer, []).unrankedReason).not.toBeNull();
  });

  it('ranks flagged players only with the test-phase switch on, and never banned or test accounts', () => {
    process.env.RANK_FLAGGED_PLAYERS = 'true';
    expect(flaggedAreRanked()).toBe(true);
    expect(isRanked(flaggedPlayer)).toBe(true);
    expect(toMe(flaggedPlayer, [])).toMatchObject({ ranked: true, unrankedReason: null });
    expect(isRanked({ ...flaggedPlayer, banned: true })).toBe(false);
    expect(isRanked({ ...flaggedPlayer, testAccount: true })).toBe(false);
  });
});
