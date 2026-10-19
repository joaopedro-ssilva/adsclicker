import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { Decimal, createInitialState } from '@/game/engine';
import { judgePostdoc } from './postdocBounds';
import { maxAngeloCapFactor } from '@/game/engine/prestige';

const T0 = 1_700_000_000_000;

function state(lifetime: string, graduations: number) {
  const s = createInitialState(content, T0);
  s.lifetimeCoins = new Decimal(lifetime);
  s.counters.graduations = graduations;
  return s;
}

describe('judgePostdoc', () => {
  it('accepts stars paid with earned coins, one per turma', () => {
    const next = state('1e40', 2);
    next.postdoc.stars.pablo = 3; // 1e30 + 1e33 + 1e36
    expect(judgePostdoc(null, next, content)).toBeNull();
  });

  it('refuses stars the lifetime coins could not have paid', () => {
    const next = state('1e32', 5);
    next.postdoc.stars.pablo = 2;
    expect(judgePostdoc(null, next, content)).toMatch(/coins/);
  });

  it('refuses more stars than turmas lived', () => {
    const next = state('1e80', 0);
    next.postdoc.stars.b1 = 2;
    expect(judgePostdoc(null, next, content)).toMatch(/turmas/);
  });

  it('refuses stars that went backwards', () => {
    const previous = state('1e40', 4);
    previous.postdoc.stars.guto = 2;
    const next = state('1e40', 4);
    next.postdoc.stars.guto = 1;
    expect(judgePostdoc(previous, next, content)).toMatch(/backwards/);
  });

  it('stretches the diploma cap ceiling for the five stars of Angelo', () => {
    const { mastery, postdoc } = content.balance;
    expect(maxAngeloCapFactor(content, false)).toBeCloseTo(1 + 0.005 * mastery.cap * (1 + postdoc.bonusPerStar * postdoc.maxStars));
  });
});
