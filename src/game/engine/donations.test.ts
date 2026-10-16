import { describe, expect, it } from 'vitest';
import { donationTitles } from '../content/donations';
import { Decimal } from './decimal';
import { donateToCampus, donationProgress, donationTitleFor, MIN_DONATION } from './donations';
import { formatNumber, parseAmount } from './format';
import { deserializeState, serializeState } from './save';
import { coins, eventsOf, newCleanGame, T0 } from './__fixtures__/helpers';

describe('donateToCampus', () => {
  it('spends the coins, adds to the total and counts the donation', () => {
    const g = newCleanGame();
    coins(g.state, 1000);
    expect(donateToCampus(g.state, g.content, new Decimal(250), T0, g.emit)).toBe(true);
    expect(g.state.coins.toNumber()).toBe(750);
    expect(g.state.donated.toNumber()).toBe(250);
    expect(g.state.counters.donations).toBe(1);
    expect(donateToCampus(g.state, g.content, new Decimal(750), T0, g.emit)).toBe(true);
    expect(g.state.coins.toNumber()).toBe(0);
    expect(g.state.donated.toNumber()).toBe(1000);
    expect(g.state.counters.donations).toBe(2);
    expect(eventsOf(g.events, 'donate')).toHaveLength(2);
  });

  it('refuses nothing, zero, more than the coins in hand and nonsense, changing nothing', () => {
    const g = newCleanGame();
    coins(g.state, 100);
    for (const bad of [new Decimal(0), new Decimal(-5), new Decimal(0.5), new Decimal(101), new Decimal(Infinity), new Decimal(NaN)]) {
      expect(donateToCampus(g.state, g.content, bad, T0, g.emit)).toBe(false);
    }
    expect(g.state.coins.toNumber()).toBe(100);
    expect(g.state.donated.toNumber()).toBe(0);
    expect(g.state.counters.donations).toBe(0);
    expect(g.events).toHaveLength(0);
    expect(MIN_DONATION.toNumber()).toBe(1);
  });

  it('reports the title a donation earns, once', () => {
    const g = newCleanGame();
    coins(g.state, '5e12');
    donateToCampus(g.state, g.content, new Decimal('1e12'), T0, g.emit);
    donateToCampus(g.state, g.content, new Decimal('1e11'), T0, g.emit);
    const [first, second] = eventsOf(g.events, 'donate');
    expect(first!.title).toBe('voluntario');
    expect(second!.title).toBeNull();
  });

  it('does not touch the lifetime coins or the run', () => {
    const g = newCleanGame();
    coins(g.state, 500);
    g.state.lifetimeCoins = new Decimal(800);
    g.state.runCoins = new Decimal(800);
    donateToCampus(g.state, g.content, new Decimal(500), T0, g.emit);
    expect(g.state.lifetimeCoins.toNumber()).toBe(800);
    expect(g.state.runCoins.toNumber()).toBe(800);
  });
});

describe('donation titles', () => {
  it('are ordered by threshold, with distinct ids', () => {
    const thresholds = donationTitles.map((title) => new Decimal(title.threshold));
    thresholds.forEach((value, i) => i > 0 && expect(value.gt(thresholds[i - 1]!)).toBe(true));
    expect(new Set(donationTitles.map((title) => title.id)).size).toBe(donationTitles.length);
  });

  it('are earned at the thresholds', () => {
    expect(donationTitleFor(new Decimal(0))).toBeNull();
    expect(donationTitleFor(new Decimal('9.9e23'))?.id).toBe('voluntario');
    expect(donationTitleFor(new Decimal('1e24'))?.id).toBe('apoiador');
    expect(donationTitleFor(new Decimal('1e33'))?.id).toBe('patrocinador');
    expect(donationTitleFor(new Decimal('1e45'))?.id).toBe('mecenas');
    expect(donationTitleFor(new Decimal('1e63'))?.id).toBe('benfeitor');
    expect(donationTitleFor(new Decimal('1e200'))?.id).toBe('nome-no-predio');
  });

  it('say what is missing for the next one', () => {
    const none = donationProgress(new Decimal(0));
    expect(none.current).toBeNull();
    expect(none.next?.id).toBe('voluntario');
    expect(none.progress).toBe(0);

    const half = donationProgress(new Decimal('1e18'));
    expect(half.current?.id).toBe('voluntario');
    expect(half.next?.id).toBe('apoiador');
    expect(half.progress).toBeCloseTo(0.5, 5);
    expect(half.missing.eq(new Decimal('1e24').sub(new Decimal('1e18')))).toBe(true);

    const done = donationProgress(new Decimal('1e100'));
    expect(done.next).toBeNull();
    expect(done.progress).toBe(1);
    expect(done.missing.eq(0)).toBe(true);
  });
});

describe('save', () => {
  it('round-trips the total and the count', () => {
    const g = newCleanGame();
    g.state.lifetimeCoins = new Decimal('1e40');
    coins(g.state, '3e30');
    donateToCampus(g.state, g.content, new Decimal('2e30'), T0, g.emit);
    const loaded = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(loaded.donated.eq(g.state.donated)).toBe(true);
    expect(loaded.counters.donations).toBe(1);
  });

  it('loads an old save without the field as nothing donated, and caps the total at the lifetime coins', () => {
    const g = newCleanGame();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.donated;
    delete (raw.counters as Record<string, unknown>).donations;
    const old = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(old.donated.eq(0)).toBe(true);
    expect(old.counters.donations).toBe(0);

    raw.donated = '1e50';
    raw.lifetimeCoins = '1e20';
    const forged = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(forged.donated.lte(forged.lifetimeCoins)).toBe(true);
    raw.donated = 'banana';
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.donated.eq(0)).toBe(true);
  });
});

describe('parseAmount', () => {
  it('reads what formatNumber writes', () => {
    for (const value of ['1500', '2.5e30', '7e45', '123456']) {
      const parsed = parseAmount(formatNumber(new Decimal(value)))!;
      expect(parsed.div(new Decimal(value)).toNumber()).toBeCloseTo(1, 2);
    }
  });

  it('accepts suffixes in any case, spaces, commas and plain numbers', () => {
    expect(parseAmount('5 Qad')!.eq(new Decimal('5e45'))).toBe(true);
    expect(parseAmount('5qad')!.eq(new Decimal('5e45'))).toBe(true);
    expect(parseAmount('1,5 M')!.eq(new Decimal(1.5e6))).toBe(true);
    expect(parseAmount('1.5 M')!.eq(new Decimal(1.5e6))).toBe(true);
    expect(parseAmount('2.500')!.toNumber()).toBe(2500);
    expect(parseAmount('1e30')!.eq(new Decimal('1e30'))).toBe(true);
    expect(parseAmount('42')!.toNumber()).toBe(42);
  });

  it('rejects empty, negative, zero and unknown suffixes', () => {
    for (const bad of ['', '  ', '-5', '0', 'abc', '5 xyz', '1..2', '5 M M']) expect(parseAmount(bad)).toBeNull();
  });
});
