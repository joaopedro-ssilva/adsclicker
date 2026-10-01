import { describe, expect, it } from 'vitest';
import { Decimal } from '../engine/decimal';
import { createInitialState } from '../engine/init';
import { fixture } from '../engine/__fixtures__/content';
import { cloneState, publishState } from './share';

describe('cloneState', () => {
  it('copies every nested object but keeps Decimals (immutable)', () => {
    const state = createInitialState(fixture, 1);
    const copy = cloneState(state);
    expect(copy).toEqual(state);
    expect(copy).not.toBe(state);
    expect(copy.levels).not.toBe(state.levels);
    expect(copy.counters).not.toBe(state.counters);
    expect(copy.coins).toBeInstanceOf(Decimal);
    expect(copy.coins).toBe(state.coins);
  });

  it('is detached from the original', () => {
    const state = createInitialState(fixture, 1);
    const copy = cloneState(state);
    state.levels['cafe'] = 5;
    state.buffs.push({ id: 'x', name: 'x', emoji: 'x', effects: [], startedAt: 0, endsAt: 1, source: 'ability' });
    expect(copy.levels['cafe']).toBeUndefined();
    expect(copy.buffs).toHaveLength(0);
  });
});

describe('publishState', () => {
  it('always returns a new top-level reference', () => {
    const working = createInitialState(fixture, 1);
    const first = publishState(cloneState(working), working);
    const second = publishState(first, working);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it('reuses nested objects that did not change', () => {
    const working = createInitialState(fixture, 1);
    const first = publishState(cloneState(working), working);
    working.lastTickAt += 100;
    working.counters.playSeconds += 0.1;
    const second = publishState(first, working);
    expect(second.lastTickAt).toBe(first.lastTickAt + 100);
    expect(second.counters).not.toBe(first.counters);
    expect(second.levels).toBe(first.levels);
    expect(second.hired).toBe(first.hired);
    expect(second.settings).toBe(first.settings);
    expect(second.skins).toBe(first.skins);
    expect(second.coins).toBe(first.coins);
  });

  it('gives changed containers a new reference, whatever the kind of change', () => {
    const working = createInitialState(fixture, 1);
    const first = publishState(cloneState(working), working);

    working.levels['cafe'] = 1;
    working.research['r-global'] = true;
    working.buffs.push({ id: 'b', name: 'b', emoji: 'b', effects: [{ stat: 'idlePower', op: 'mult', value: 2 }], startedAt: 0, endsAt: 9, source: 'ability' });
    working.coins = new Decimal(5);
    working.invasion = { uid: 1, def: 'phishing', spawnedAt: 0, expiresAt: 5, clicksLeft: 3, x: 0.1, y: 0.2 };
    const second = publishState(first, working);
    expect(second.levels).not.toBe(first.levels);
    expect(second.research).not.toBe(first.research);
    expect(second.buffs).not.toBe(first.buffs);
    expect(second.coins).not.toBe(first.coins);
    expect(second.invasion).toEqual(working.invasion);

    // an in-place mutation of a nested object (hitting an invasion) is detected too
    working.invasion!.clicksLeft = 2;
    const third = publishState(second, working);
    expect(third.invasion).not.toBe(second.invasion);
    expect(second.invasion!.clicksLeft).toBe(3);
    expect(third.invasion!.clicksLeft).toBe(2);
    expect(third.buffs).toBe(second.buffs);
  });

  it('detects removed keys', () => {
    const working = createInitialState(fixture, 1);
    working.levels['cafe'] = 1;
    const first = publishState(cloneState(working), working);
    delete working.levels['cafe'];
    const second = publishState(first, working);
    expect(second.levels).toEqual({});
    expect(second.levels).not.toBe(first.levels);
  });

  it('shares equal Decimals', () => {
    const working = createInitialState(fixture, 1);
    working.coins = new Decimal('1.5e40');
    const first = publishState(cloneState(working), working);
    working.coins = new Decimal('1.5e40'); // a new instance with the same value
    const second = publishState(first, working);
    expect(second.coins).toBe(first.coins);
  });
});
