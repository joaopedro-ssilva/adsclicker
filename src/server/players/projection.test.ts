import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { Decimal, createInitialState } from '@/game/engine';
import { coinsOutOfRange, projectState } from './projection';

describe('projectState', () => {
  it('projects a fresh game to zeros and the starting professor', () => {
    const projection = projectState(createInitialState(content, 1_000));
    expect(projection).toMatchObject({
      lifetimeCoinsText: '0',
      lifetimeCoinsLog: 0,
      diplomasEarned: 0,
      graduations: 0,
      clicks: 0,
      achievements: 0,
      professors: 1,
      playSeconds: 0,
      avatarProfessor: 'edecio',
    });
    expect(projection.avatarSkin).not.toBe('');
  });

  it('keeps the exact coin text, a numeric-ready copy and a base-10 log for ordering', () => {
    const state = createInitialState(content, 1_000);
    state.lifetimeCoins = new Decimal('3.2e300');
    const projection = projectState(state);
    expect(projection.lifetimeCoinsText).toBe('3.2e+300');
    expect(projection.lifetimeCoins).toBe(projection.lifetimeCoinsText);
    expect(projection.lifetimeCoinsLog).toBeCloseTo(300.505, 3);
  });

  it('orders by log: a bigger fortune never sorts lower', () => {
    const logs = ['5', '1e3', '1e21', '1e100', '9e300'].map((text) => {
      const state = createInitialState(content, 1_000);
      state.lifetimeCoins = new Decimal(text);
      return projectState(state).lifetimeCoinsLog;
    });
    expect([...logs].sort((a, b) => a - b)).toEqual(logs);
  });

  it('counts achievements, hired professors and the equipped skin of the professor on stage', () => {
    const state = createInitialState(content, 1_000);
    state.achievements = { a: 1, b: 2, c: 3 };
    state.hired.gladimir = true;
    state.activeProfessor = 'gladimir';
    state.counters.clicks = 12.9;
    const projection = projectState(state);
    expect(projection.achievements).toBe(3);
    expect(projection.professors).toBe(2);
    expect(projection.avatarProfessor).toBe('gladimir');
    expect(projection.avatarSkin).toBe(state.equippedSkin.gladimir);
    expect(projection.clicks).toBe(12);
  });

  it('flags coins too large to store', () => {
    const state = createInitialState(content, 1_000);
    state.lifetimeCoins = new Decimal('1e4000');
    expect(coinsOutOfRange(state)).toBe(false);
    state.lifetimeCoins = new Decimal('1e9000');
    expect(coinsOutOfRange(state)).toBe(true);
  });
});
