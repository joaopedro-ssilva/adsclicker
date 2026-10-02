import { num, signed } from './labels';

/** A signed difference: green and "+" for a gain, red and "−" for a loss. */
export function Delta({ value, suffix = '', decimals = 1 }: { value: number; suffix?: string; decimals?: number }) {
  if (Math.abs(value) < 10 ** -decimals / 2) return <span className="hk-delta">{num(0, decimals)}{suffix}</span>;
  return (
    <span className="hk-delta" data-tone={value > 0 ? 'good' : 'bad'}>
      {signed(value, decimals)}
      {suffix}
    </span>
  );
}
