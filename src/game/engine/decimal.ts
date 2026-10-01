import Decimal from 'break_infinity.js';
import type { DecimalSource } from 'break_infinity.js';

export { Decimal };
export type { DecimalSource };

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);

const parsed = new Map<string, Decimal>();

/**
 * Parses a decimal string from content or a save. Decimals are immutable, so parsed
 * values are shared. Anything unparseable becomes zero instead of throwing.
 */
export function parseDecimal(value: string): Decimal {
  const cached = parsed.get(value);
  if (cached) return cached;
  let result = ZERO;
  try {
    const candidate = new Decimal(value);
    if (Number.isFinite(candidate.m) && Number.isFinite(candidate.e)) result = candidate;
  } catch {
    result = ZERO;
  }
  parsed.set(value, result);
  return result;
}

/** Decimal from any source; NaN and unparseable strings become zero. */
export function toDecimal(value: DecimalSource): Decimal {
  if (value instanceof Decimal) return Number.isNaN(value.m) ? ZERO : value;
  if (typeof value === 'string') return parseDecimal(value);
  return Number.isNaN(value) ? ZERO : new Decimal(value);
}

/** a / b as a plain number clamped to 0..1. Safe for any magnitude. */
export function ratio(a: Decimal, b: Decimal): number {
  if (b.lte(0)) return 1;
  if (a.gte(b)) return 1;
  if (a.lte(0)) return 0;
  const value = a.div(b).toNumber();
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function decimalMax(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}
