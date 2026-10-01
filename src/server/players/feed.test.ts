import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { createInitialState } from '@/game/engine';
import { MAX_EVENTS_PER_SYNC, diffFeed } from './feed';

const fresh = () => createInitialState(content, 1_000);
const skinOf = (rarity: string) => {
  const skin = content.skins.find((candidate) => candidate.rarity === rarity && !candidate.default);
  if (!skin) throw new Error(`no ${rarity} skin in the content`);
  return skin.id;
};

describe('diffFeed', () => {
  it('announces nothing without a previous save', () => {
    const next = fresh();
    for (const id of PROFESSOR_IDS) next.hired[id] = true;
    expect(diffFeed(null, next)).toEqual([]);
  });

  it('announces each newly hired professor', () => {
    const previous = fresh();
    const next = fresh();
    next.hired.gladimir = true;
    next.hired.wagner = true;
    expect(diffFeed(previous, next)).toEqual([
      { kind: 'hire', detail: 'gladimir' },
      { kind: 'hire', detail: 'wagner' },
    ]);
  });

  it('announces the complete faculty once, with the last hire', () => {
    const previous = fresh();
    for (const id of PROFESSOR_IDS) previous.hired[id] = true;
    previous.hired.pablo = false;
    const next = fresh();
    for (const id of PROFESSOR_IDS) next.hired[id] = true;
    expect(diffFeed(previous, next)).toEqual([
      { kind: 'hire', detail: 'pablo' },
      { kind: 'allProfessors', detail: '' },
    ]);
    expect(diffFeed(next, next)).toEqual([]);
  });

  it('announces a graduation with its number', () => {
    const previous = fresh();
    previous.counters.graduations = 2;
    const next = fresh();
    next.counters.graduations = 3;
    expect(diffFeed(previous, next)).toEqual([{ kind: 'graduation', detail: '3' }]);
  });

  it('announces epic and legendary skins only', () => {
    const previous = fresh();
    const next = fresh();
    next.skins[skinOf('common')] = true;
    next.skins[skinOf('rare')] = true;
    next.skins[skinOf('epic')] = true;
    next.skins[skinOf('legendary')] = true;
    expect(diffFeed(previous, next)).toEqual([
      { kind: 'skin', detail: skinOf('epic') },
      { kind: 'skin', detail: skinOf('legendary') },
    ]);
  });

  it('never returns more than the per-sync cap', () => {
    const previous = fresh();
    const next = fresh();
    for (const id of PROFESSOR_IDS) next.hired[id] = true;
    for (const skin of content.skins) next.skins[skin.id] = true;
    next.counters.graduations = 5;
    expect(diffFeed(previous, next)).toHaveLength(MAX_EVENTS_PER_SYNC);
  });
});
