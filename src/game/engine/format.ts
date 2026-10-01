import { toDecimal } from './decimal';
import type { DecimalSource } from './decimal';

/** Short-scale suffixes by thousands group: 1e3 K, 1e6 M ... 1e33 Dc. Past that: scientific. */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const;

/** Below this the number is shown whole with thousands separators: 1.234. */
const PLAIN_LIMIT_EXPONENT = 4;

export interface FormatNumberOptions {
  /** Drop fractions below 10.000 (coin counters): 15,7 becomes 15. */
  integer?: boolean;
  /** Significant digits of the abbreviated form. Default 3: "12,5 K", "3,21 M". */
  digits?: number;
}

function group(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** pt-BR fixed-point text without trailing zeros: 12.50 -> "12,5". Expects a non-negative number. */
function fixed(value: number, fraction: number): string {
  const [integerPart = '0', fractionPart = ''] = value.toFixed(fraction).split('.');
  const trimmed = fractionPart.replace(/0+$/, '');
  return trimmed ? `${group(integerPart)},${trimmed}` : group(integerPart);
}

function fractionDigitsFor(mantissa: number, digits: number): number {
  const integerDigits = mantissa < 10 ? 1 : mantissa < 100 ? 2 : 3;
  return Math.max(0, digits - integerDigits);
}

export function formatNumber(value: DecimalSource, opts: FormatNumberOptions = {}): string {
  const digits = opts.digits ?? 3;
  const d = toDecimal(value);
  if (d.m === 0) return '0';
  if (d.e >= 9e15) return d.m < 0 ? '-∞' : '∞';

  const sign = d.m < 0 ? '-' : '';
  const abs = d.abs();

  if (abs.e < PLAIN_LIMIT_EXPONENT) {
    const n = abs.toNumber();
    if (opts.integer || n >= 1000) return sign + fixed(Math.floor(n), 0);
    if (n < 1) return sign + fixed(n, 2);
    return sign + fixed(n, n < 10 ? 2 : 1);
  }

  const exponent = abs.e;
  let group3 = Math.floor(exponent / 3);
  if (group3 >= SUFFIXES.length) return sign + scientific(abs.m, exponent, digits);

  let mantissa = abs.m * 10 ** (exponent - group3 * 3);
  mantissa = Number(mantissa.toFixed(fractionDigitsFor(mantissa, digits)));
  if (mantissa >= 1000) {
    mantissa /= 1000;
    group3 += 1;
    if (group3 >= SUFFIXES.length) return sign + scientific(mantissa, group3 * 3, digits);
  }
  return `${sign}${fixed(mantissa, fractionDigitsFor(mantissa, digits))} ${SUFFIXES[group3]}`;
}

/** 1,23e36: mantissa in [1, 10) with `digits` significant digits. */
function scientific(mantissa: number, exponent: number, digits: number): string {
  const places = Math.max(0, digits - 1);
  let rounded = Number(mantissa.toFixed(places));
  let power = exponent;
  if (rounded >= 10) {
    rounded /= 10;
    power += 1;
  }
  return `${fixed(rounded, places)}e${power}`;
}

/** "2 h 05 min", "3 min 20 s", "45 s", "1 d 04 h". Zero lower units are dropped. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) return hours > 0 ? `${days} d ${pad(hours)} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${pad(minutes)} min` : `${hours} h`;
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${pad(seconds)} s` : `${minutes} min`;
  return `${seconds} s`;
}

/** 0.153 -> "15%" (default) or "15,3%" with one decimal. */
export function formatPercent(fraction: number, decimals = 0): string {
  if (!Number.isFinite(fraction)) return '0%';
  const sign = fraction < 0 ? '-' : '';
  return `${sign}${fixed(Math.abs(fraction) * 100, decimals)}%`;
}
