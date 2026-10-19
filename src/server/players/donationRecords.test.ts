import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { Decimal, createInitialState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { judgeDonations } from './donationRecords';
import { projectState } from './projection';

const NOW = 1_800_000_000_000;

function state(values: { coins?: string; lifetime?: string; donated?: string }): GameState {
  const s = createInitialState(content, NOW);
  s.coins = new Decimal(values.coins ?? '0');
  s.lifetimeCoins = new Decimal(values.lifetime ?? '0');
  s.donated = new Decimal(values.donated ?? '0');
  return s;
}

describe('judgeDonations', () => {
  it('accepts no donations, and a first sync that fits the lifetime coins', () => {
    expect(judgeDonations({ previous: null, next: state({ lifetime: '1e20' }), gain: new Decimal('1e20') })).toBeNull();
    expect(judgeDonations({ previous: null, next: state({ lifetime: '1e20', donated: '9e19' }), gain: new Decimal('1e20') })).toBeNull();
  });

  it('rejects a total above the lifetime coins', () => {
    expect(judgeDonations({ previous: null, next: state({ lifetime: '1e20', donated: '2e20' }), gain: new Decimal('1e20') })).toContain('lifetime');
  });

  it('lets the total grow by the coins in hand plus the coins earned since', () => {
    const previous = state({ coins: '4e20', lifetime: '1e21', donated: '1e20' });
    const next = state({ coins: '0', lifetime: '1.5e21', donated: '1e20' });
    // gave away the 4e20 in hand and 3e20 of the 5e20 earned since
    next.donated = new Decimal('8e20');
    expect(judgeDonations({ previous, next, gain: new Decimal('5e20') })).toBeNull();
  });

  it('rejects a total that grew by more than that', () => {
    const previous = state({ coins: '1e20', lifetime: '1e21', donated: '0' });
    const next = state({ coins: '0', lifetime: '1.1e21', donated: '5e20' });
    expect(judgeDonations({ previous, next, gain: new Decimal('1e20') })).toContain('more than the coins available');
  });

  it('rejects a total that went down', () => {
    const previous = state({ coins: '0', lifetime: '1e21', donated: '5e20' });
    const next = state({ coins: '0', lifetime: '1e21', donated: '4e20' });
    expect(judgeDonations({ previous, next, gain: new Decimal(0) })).toContain('backwards');
  });
});

describe('projectState: the donors column', () => {
  it('writes the exact text and the log10, and 0 below one coin', () => {
    const projected = projectState(state({ lifetime: '1e50', donated: '2.5e30' }));
    expect(projected.donatedText).toBe('2.5e+30');
    expect(projected.donatedLog).toBeCloseTo(30.39794, 4);
    expect(projectState(state({})).donatedLog).toBe(0);
    expect(projectState(state({})).donatedText).toBe('0');
  });
});
