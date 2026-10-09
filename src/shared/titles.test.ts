import { describe, expect, it } from 'vitest';
import {
  adminPlayerPatchSchema,
  feedItemSchema,
  leaderboardEntrySchema,
  meSchema,
  meResponseSchema,
  syncRequestSchema,
  syncResponseSchema,
} from './api';
import { TITLES, TITLE_IDS, isTitleId, sortTitles, titleById } from './titles';
import { titleIdsOf, titlesForWire } from '../server/players/titles';
import { toMe } from '../server/players/summary';

describe('title catalogue', () => {
  it('starts with the two titles of the launch, each with a label, a description and a colour', () => {
    expect(TITLE_IDS).toEqual(['primeiro-platinado', 'turma-zero']);
    for (const title of TITLES) {
      expect(title.label.length).toBeGreaterThan(0);
      expect(title.description.length).toBeGreaterThan(0);
      expect(['gold', 'cyan']).toContain(title.tone);
    }
    expect(titleById('turma-zero')?.label).toBe('Turma Zero');
    expect(titleById('primeiro-platinado')?.single).toBe(true);
    expect(titleById('turma-zero')?.single).toBeUndefined();
    expect(isTitleId('turma-zero')).toBe(true);
    expect(isTitleId('rei')).toBe(false);
  });

  it('sorts by priority, drops unknown ids and repeats', () => {
    expect(sortTitles(['turma-zero', 'primeiro-platinado']).map((title) => title.id)).toEqual(['primeiro-platinado', 'turma-zero']);
    expect(sortTitles(['turma-zero', 'turma-zero', 'removido']).map((title) => title.id)).toEqual(['turma-zero']);
    expect(sortTitles([])).toEqual([]);
    expect(sortTitles(undefined)).toEqual([]);
  });

  it('puts nothing on the wire for a player without titles', () => {
    expect(titleIdsOf(['x'])).toEqual([]);
    expect(titlesForWire([])).toBeUndefined();
    expect(titlesForWire(['turma-zero'])).toEqual(['turma-zero']);
    const player = { id: 'p', nickname: 'Ana', passwordHash: 'h', flagged: false, banned: false, testAccount: false };
    expect(toMe({ ...player, titles: [] })).not.toHaveProperty('titles');
    expect(toMe(player)).not.toHaveProperty('titles');
    expect(toMe({ ...player, titles: ['turma-zero', 'primeiro-platinado'] }).titles).toEqual(['primeiro-platinado', 'turma-zero']);
  });
});

describe('contract stays additive', () => {
  const me = { id: 'p', nickname: null, hasPassword: false, ranked: false, unrankedReason: null };

  it('reads what an older server sends (no titles, no epoch)', () => {
    expect(meSchema.safeParse(me).success).toBe(true);
    expect(meResponseSchema.safeParse({ me: null, multiplier: 1, cloud: null }).success).toBe(true);
    expect(
      leaderboardEntrySchema.safeParse({ rank: 1, nickname: 'A', value: '1', professor: 'edecio', skin: '', diplomas: 0, achievements: 0, online: false })
        .success,
    ).toBe(true);
    expect(feedItemSchema.safeParse({ id: 'i', nickname: 'A', kind: 'hire', detail: null, at: 1 }).success).toBe(true);
  });

  it('accepts a sync body without an epoch (an older client) and a reset answer', () => {
    expect(syncRequestSchema.safeParse({ save: '{}', baseRev: 0 }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ save: '{}', baseRev: 0, epoch: 1 }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ save: '{}', baseRev: 0, epoch: -1 }).success).toBe(false);
    expect(syncResponseSchema.safeParse({ status: 'reset', epoch: 1, multiplier: 1, me }).success).toBe(true);
  });

  it('keeps an admin patch without titles valid and refuses unknown title ids', () => {
    expect(adminPlayerPatchSchema.safeParse({ banned: true }).success).toBe(true);
    expect(adminPlayerPatchSchema.safeParse({ revokeTitle: 'turma-zero' }).success).toBe(true);
    expect(adminPlayerPatchSchema.safeParse({ revokeTitle: 'nada' }).success).toBe(false);
  });
});
