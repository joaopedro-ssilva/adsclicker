import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { Decimal, createInitialState } from '@/game/engine';
import { buildProfile } from './profile';

const NOW = 1_800_000_000_000;
const row = {
  nickname: 'Maria',
  createdAt: new Date(NOW - 86_400_000),
  lastSeenAt: new Date(NOW - 5_000),
  avatarProfessor: 'gladimir',
  avatarSkin: 'gladimir-dba',
  titles: [],
};

describe('public profile', () => {
  it('shows what is on screen and the main numbers from the save', () => {
    const state = createInitialState(content, NOW);
    state.hired.wagner = true;
    state.activeProfessor = 'wagner';
    state.equippedSkin.wagner = 'wagner-hacker';
    state.equippedScenery = 'praia';
    state.lifetimeCoins = new Decimal('1e12');
    state.counters.clicks = 1234;
    state.counters.graduations = 3;
    state.skins['wagner-hacker'] = true;
    state.achievements['click-100'] = NOW;

    const profile = buildProfile(row, state, undefined, NOW);
    expect(profile).toMatchObject({ nickname: 'Maria', professor: 'wagner', skin: 'wagner-hacker', scenery: 'praia', online: true });
    expect(profile.tags).toBeUndefined();
    expect(profile.stats).toMatchObject({ lifetimeCoins: '1000000000000', clicks: 1234, graduations: 3, professorsHired: 2, achievements: 1 });
    expect(profile.stats.skins).toBe(Object.values(state.skins).filter(Boolean).length);
    // Nothing private: no coins in hand, no account flags.
    expect(Object.keys(profile)).toEqual(['nickname', 'professor', 'skin', 'scenery', 'online', 'memberSince', 'stats']);
  });

  it('falls back to the ranking avatar when there is no cloud save', () => {
    const profile = buildProfile({ ...row, lastSeenAt: new Date(NOW - 3_600_000) }, null, undefined, NOW);
    expect(profile).toMatchObject({ professor: 'gladimir', skin: 'gladimir-dba', scenery: '', online: false });
    expect(profile.stats.lifetimeCoins).toBe('0');
  });
});
