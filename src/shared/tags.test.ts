import { describe, expect, it } from 'vitest';
import type { PlayerTagRow } from '../server/db/schema';
import { publicTagsOf, tagIdsOf } from '../server/players/tags';
import { toMe } from '../server/players/summary';
import {
  adminPlayerPatchSchema,
  adminTagCreateSchema,
  adminTagPatchSchema,
  feedItemSchema,
  leaderboardEntrySchema,
  meResponseSchema,
  meSchema,
  syncRequestSchema,
  syncResponseSchema,
} from './api';
import { tagSlug, tagTextColor } from './tags';

const tag = (id: string, visibility: 'public' | 'admin', position: number): PlayerTagRow => ({
  id,
  label: id.toUpperCase(),
  description: `about ${id}`,
  color: '#f2c744',
  visibility,
  single: false,
  position,
  createdAt: new Date(0),
});

const catalog = [tag('ouro', 'public', 0), tag('olho', 'admin', 1), tag('turma', 'public', 2)];

describe('tags on the wire', () => {
  it('sends only public tags, in catalogue order, without repeats or deleted ids', () => {
    expect(publicTagsOf(catalog, ['turma', 'olho', 'ouro', 'turma', 'apagada'])?.map((entry) => entry.id)).toEqual(['ouro', 'turma']);
    expect(publicTagsOf(catalog, ['turma'])).toEqual([{ id: 'turma', label: 'TURMA', description: 'about turma', color: '#f2c744' }]);
  });

  it('puts nothing on the wire for a player without public tags', () => {
    expect(publicTagsOf(catalog, [])).toBeUndefined();
    expect(publicTagsOf(catalog, null)).toBeUndefined();
    expect(publicTagsOf(catalog, ['olho'])).toBeUndefined();
    const player = { id: 'p', nickname: 'Ana', passwordHash: 'h', flagged: false, banned: false, testAccount: false };
    expect(toMe({ ...player, titles: ['olho'] }, catalog)).not.toHaveProperty('tags');
    expect(toMe(player, catalog)).not.toHaveProperty('tags');
    expect(toMe({ ...player, titles: ['turma', 'ouro'] }, catalog).tags?.map((entry) => entry.id)).toEqual(['ouro', 'turma']);
  });

  it('lists every known tag for /admin, admin-only ones included', () => {
    expect(tagIdsOf(catalog, ['turma', 'olho', 'apagada'])).toEqual(['olho', 'turma']);
    expect(tagIdsOf(catalog, undefined)).toEqual([]);
  });
});

describe('tag helpers', () => {
  it('makes readable ids from names', () => {
    expect(tagSlug('Campeão do Semestre')).toBe('campeao-do-semestre');
    expect(tagSlug('  ★ Top 1! ')).toBe('top-1');
    expect(tagSlug('!!!')).toBe('tag');
    expect(tagSlug('a'.repeat(50)).length).toBeLessThanOrEqual(32);
  });

  it('picks a dark text on light colours and white on dark ones', () => {
    expect(tagTextColor('#f2c744')).toContain('color-mix');
    expect(tagTextColor('#6fd6e6')).toContain('color-mix');
    expect(tagTextColor('#1a1a2e')).toBe('#ffffff');
    expect(tagTextColor('vermelho')).toBe('#111111');
  });
});

describe('the admin tag contract', () => {
  it('validates name, colour and visibility, and fills the defaults', () => {
    expect(adminTagCreateSchema.parse({ label: '  Veterano ', color: '#FF9F43', visibility: 'public' })).toEqual({
      label: 'Veterano',
      description: '',
      color: '#ff9f43',
      visibility: 'public',
      single: false,
    });
    expect(adminTagCreateSchema.safeParse({ label: '', color: '#ff9f43', visibility: 'public' }).success).toBe(false);
    expect(adminTagCreateSchema.safeParse({ label: 'x'.repeat(25), color: '#ff9f43', visibility: 'public' }).success).toBe(false);
    expect(adminTagCreateSchema.safeParse({ label: 'X', color: 'red', visibility: 'public' }).success).toBe(false);
    expect(adminTagCreateSchema.safeParse({ label: 'X', color: '#ff9f43', visibility: 'secret' }).success).toBe(false);
    expect(adminTagPatchSchema.parse({ visibility: 'admin' })).toEqual({ visibility: 'admin' });
  });

  it('keeps an admin patch without tags valid', () => {
    expect(adminPlayerPatchSchema.safeParse({ banned: true }).success).toBe(true);
    expect(adminPlayerPatchSchema.safeParse({ revokeTag: 'turma-zero' }).success).toBe(true);
    expect(adminPlayerPatchSchema.safeParse({ grantTag: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('contract stays additive', () => {
  const me = { id: 'p', nickname: null, hasPassword: false, ranked: false, unrankedReason: null };

  it('reads what an older server sends (no tags, no epoch, or the old title ids)', () => {
    expect(meSchema.safeParse(me).success).toBe(true);
    expect(meSchema.safeParse({ ...me, titles: ['turma-zero'] }).success).toBe(true);
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
});
