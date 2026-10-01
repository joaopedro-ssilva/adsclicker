import { describe, expect, it } from 'vitest';
import { formatAgo } from './formatAgo';

describe('formatAgo', () => {
  it('counts seconds, then minutes, then hours', () => {
    expect(formatAgo(12_400)).toBe('há 12 s');
    expect(formatAgo(59_999)).toBe('há 59 s');
    expect(formatAgo(60_000)).toBe('há 1 min');
    expect(formatAgo(59 * 60_000 + 30_000)).toBe('há 59 min');
    expect(formatAgo(3 * 3_600_000)).toBe('há 3 h');
  });

  it('never goes negative when the clocks disagree', () => {
    expect(formatAgo(-5_000)).toBe('há 0 s');
  });
});
