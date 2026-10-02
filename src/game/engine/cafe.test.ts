import { describe, expect, it } from 'vitest';
import { buyCafe, cafeCost, CAFE_COST_SECONDS } from './cafe';
import { coinsPerSecond } from './views';
import { deserializeState, readCloudBonus, serializeState } from './save';
import { MAX_CARGO_BONUS, MAX_MENTOR_BONUS } from './state';
import { T0, coins, newCleanGame, num } from './__fixtures__/helpers';

describe('café for the Hackathon mode', () => {
  it('costs a slice of the current production, with a floor', () => {
    const g = newCleanGame();
    expect(num(cafeCost(g.state, g.content))).toBe(1000);

    g.state.levels.cafe = 50;
    const perSecond = num(coinsPerSecond(g.state, g.content));
    expect(perSecond).toBeGreaterThan(2);
    expect(num(cafeCost(g.state, g.content))).toBe(Math.max(1000, Math.ceil(perSecond * CAFE_COST_SECONDS)));
  });

  it('spends the coins and counts the purchase, or refuses and changes nothing', () => {
    const g = newCleanGame();
    coins(g.state, 999);
    expect(buyCafe(g.state, g.content, T0, g.emit)).toBe(false);
    expect(g.state.counters.cafesBought).toBe(0);
    expect(num(g.state.coins)).toBe(999);

    coins(g.state, 2500);
    expect(buyCafe(g.state, g.content, T0, g.emit)).toBe(true);
    expect(buyCafe(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.counters.cafesBought).toBe(2);
    expect(num(g.state.coins)).toBe(500);
  });
});

describe('cloud bonus from the Hackathon mode', () => {
  it('multiplies everything by the cargo and one professor by the mentor', () => {
    const g = newCleanGame();
    g.state.levels.cafe = 10;
    const base = num(coinsPerSecond(g.state, g.content));

    const withCargo = { ...g.state, cloudBonus: { cargo: 1.25, mentors: {} } };
    expect(num(coinsPerSecond(withCargo, g.content))).toBeCloseTo(base * 1.25, 6);

    const professor = g.content.disciplines.find((discipline) => discipline.id === 'cafe')!.professor;
    const withMentor = { ...g.state, cloudBonus: { cargo: 1, mentors: { [professor]: 1.3 } } };
    expect(num(coinsPerSecond(withMentor, g.content))).toBeCloseTo(base * 1.3, 6);
  });

  it('survives a save round-trip and is clamped when read', () => {
    const g = newCleanGame();
    g.state.cloudBonus = { cargo: 1.25, mentors: { edecio: 1.5 } };
    const loaded = deserializeState(serializeState(g.state), g.content, T0);
    expect(loaded?.cloudBonus).toEqual({ cargo: 1.25, mentors: { edecio: 1.5 } });

    expect(readCloudBonus({ cargo: 9999, mentors: { edecio: 9999, nobody: 3 } })).toEqual({
      cargo: MAX_CARGO_BONUS,
      mentors: { edecio: MAX_MENTOR_BONUS },
    });
    expect(readCloudBonus('nonsense')).toEqual({ cargo: 1, mentors: {} });
  });
});
