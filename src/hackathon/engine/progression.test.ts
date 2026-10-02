import { describe, expect, it } from 'vitest';
import { applyXp, classroomBonus, freeSkillPoints, mentorCost, nodeLock, xpToNext } from './index';
import { fixtureContent as content } from './__fixtures__/content';

describe('xp', () => {
  it('follows xpBase + xpStep * (level - 1)', () => {
    expect(xpToNext(1, content)).toBe(100);
    expect(xpToNext(5, content)).toBe(340);
  });

  it('levels up several times and carries the rest', () => {
    expect(applyXp({ cargo: 'estudante', level: 1, xp: 0 }, 250, content)).toEqual({ level: 2, xp: 150, levelsGained: 1 });
    expect(applyXp({ cargo: 'estudante', level: 1, xp: 50 }, 400, content)).toEqual({ level: 3, xp: 50 + 400 - 100 - 160, levelsGained: 2 });
  });

  it('keeps the bar full at the cargo cap and levels up after a promotion', () => {
    const capped = applyXp({ cargo: 'estudante', level: 10, xp: 0 }, 99999, content);
    expect(capped).toEqual({ level: 10, xp: xpToNext(10, content), levelsGained: 0 });
    expect(applyXp({ cargo: 'estagiario', level: 10, xp: capped.xp }, 0, content).level).toBe(11);
  });

  it('ignores negative amounts', () => {
    expect(applyXp({ cargo: 'estudante', level: 3, xp: 20 }, -50, content)).toEqual({ level: 3, xp: 20, levelsGained: 0 });
  });
});

describe('skill points and locks', () => {
  it('gives 1 point per level above 1 minus the spent ones', () => {
    expect(freeSkillPoints(1, {}, content)).toBe(0);
    expect(freeSkillPoints(5, {}, content)).toBe(4);
    expect(freeSkillPoints(5, { logic: 2, 'u-heal': 1 }, content)).toBe(0);
  });

  it('explains why a node is locked, in Portuguese', () => {
    expect(nodeLock('logic', 3, {}, content)).toBeNull();
    expect(nodeLock('logic', 3, { logic: 5 }, content)).toBe('Nível máximo alcançado.');
    expect(nodeLock('u-heal', 9, {}, content)).toBe('Requer "Lógica".');
    expect(nodeLock('u-heal', 2, { logic: 1 }, content)).toMatch(/Faltam pontos/);
    expect(nodeLock('u-heal', 9, { logic: 1 }, content)).toBeNull();
    expect(nodeLock('ghost', 9, {}, content)).toBe('Habilidade desconhecida.');
  });
});

describe('mentors and the classroom', () => {
  it('prices the next level and returns null when maxed', () => {
    expect(mentorCost('edecio', 0, content)).toBe(10);
    expect(mentorCost('edecio', 2, content)).toBe(30);
    expect(mentorCost('edecio', 3, content)).toBeNull();
    expect(mentorCost('wagner', 0, content)).toBeNull();
  });

  it('multiplies the cargo and each mentor with level above 0', () => {
    expect(classroomBonus({ cargo: 'estagiario', mentors: { edecio: 3, gladimir: 0 } }, content)).toEqual({ cargo: 1.25, mentors: { edecio: 1.3 } });
    expect(classroomBonus({ cargo: 'estudante', mentors: {} }, content)).toEqual({ cargo: 1, mentors: {} });
  });
});
