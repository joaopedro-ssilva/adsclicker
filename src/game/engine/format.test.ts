import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal';
import { formatDuration, formatNumber, formatPercent } from './format';

describe('formatNumber', () => {
  it('shows small numbers whole, with pt-BR separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.234');
    expect(formatNumber(9999)).toBe('9.999');
  });

  it('shows fractions below 1.000 with a comma', () => {
    expect(formatNumber(0.25)).toBe('0,25');
    expect(formatNumber(3.456)).toBe('3,46');
    expect(formatNumber(12.5)).toBe('12,5');
    expect(formatNumber(999.5)).toBe('999,5');
  });

  it('drops fractions on request', () => {
    expect(formatNumber(15.7, { integer: true })).toBe('15');
    expect(formatNumber(0.9, { integer: true })).toBe('0');
    expect(formatNumber(1234.9, { integer: true })).toBe('1.234');
  });

  it('abbreviates with three significant digits', () => {
    expect(formatNumber(12_500)).toBe('12,5 K');
    expect(formatNumber(100_000)).toBe('100 K');
    expect(formatNumber(123_456)).toBe('123 K');
    expect(formatNumber(3_210_000)).toBe('3,21 M');
    expect(formatNumber(1_000_000)).toBe('1 M');
    expect(formatNumber(4.5e9)).toBe('4,5 B');
  });

  it('walks the whole suffix ladder', () => {
    const expected: [number, string][] = [
      [6, 'M'],
      [9, 'B'],
      [12, 'T'],
      [15, 'Qa'],
      [18, 'Qi'],
      [21, 'Sx'],
      [24, 'Sp'],
      [27, 'Oc'],
      [30, 'No'],
      [33, 'Dc'],
    ];
    for (const [exponent, suffix] of expected) {
      expect(formatNumber(new Decimal(`1e${exponent}`))).toBe(`1 ${suffix}`);
    }
    expect(formatNumber(new Decimal('2.5e32'))).toBe('250 No');
    expect(formatNumber(10_000)).toBe('10 K');
  });

  it('rolls over at rounding boundaries instead of printing 1.000 K', () => {
    expect(formatNumber(999_999)).toBe('1 M');
    expect(formatNumber(new Decimal('9.999e32'))).toBe('1 Dc');
  });

  it('switches to scientific notation after Dc', () => {
    expect(formatNumber(new Decimal('1.234e36'))).toBe('1,23e36');
    expect(formatNumber(new Decimal('1e100'))).toBe('1e100');
    expect(formatNumber(new Decimal('9.999e40'))).toBe('1e41');
  });

  it('handles negatives, huge values and bad input', () => {
    expect(formatNumber(-12_500)).toBe('-12,5 K');
    expect(formatNumber(-3)).toBe('-3');
    expect(formatNumber(Number.NaN)).toBe('0');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞');
  });

  it('accepts decimal strings', () => {
    expect(formatNumber('1.5e6')).toBe('1,5 M');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes, hours and days', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(200_000)).toBe('3 min 20 s');
    expect(formatDuration(60_000)).toBe('1 min');
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe('2 h 05 min');
    expect(formatDuration(2 * 3_600_000)).toBe('2 h');
    expect(formatDuration(27 * 3_600_000)).toBe('1 d 03 h');
  });

  it('is safe with negative and broken values', () => {
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(Number.NaN)).toBe('0 s');
  });
});

describe('formatPercent', () => {
  it('formats fractions with a comma', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.153, 1)).toBe('15,3%');
    expect(formatPercent(0.15, 1)).toBe('15%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(-0.2)).toBe('-20%');
  });
});
