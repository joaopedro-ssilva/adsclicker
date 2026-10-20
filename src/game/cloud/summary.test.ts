import { describe, expect, it } from 'vitest';
import type { SaveSummary } from '@/shared/api';
import { moreProgress, sameProgress } from './summary';

const sample = (patch: Partial<SaveSummary> = {}): SaveSummary => ({
  lifetimeCoins: '1000',
  diplomasEarned: 0,
  professors: 1,
  achievements: 2,
  playSeconds: 300,
  ...patch,
});

describe('moreProgress', () => {
  it('identifies identical saves as tie', () => {
    const a = sample();
    const b = sample();
    expect(moreProgress(a, b)).toBe('tie');
  });

  it('recognizes local dominance across all metrics', () => {
    const local = sample({
      lifetimeCoins: '2000',
      diplomasEarned: 2,
      professors: 2,
      achievements: 5,
      playSeconds: 600,
    });
    const cloud = sample({
      lifetimeCoins: '1000',
      diplomasEarned: 0,
      professors: 1,
      achievements: 2,
      playSeconds: 300,
    });
    expect(moreProgress(local, cloud)).toBe('local');
  });

  it('recognizes cloud dominance across all metrics', () => {
    const local = sample({
      lifetimeCoins: '1000',
      diplomasEarned: 0,
      professors: 1,
      achievements: 2,
      playSeconds: 300,
    });
    const cloud = sample({
      lifetimeCoins: '5000',
      diplomasEarned: 1,
      professors: 2,
      achievements: 4,
      playSeconds: 800,
    });
    expect(moreProgress(local, cloud)).toBe('cloud');
  });

  it('recognizes local dominance when equal on some metrics and higher on another', () => {
    const local = sample({ diplomasEarned: 5 });
    const cloud = sample({ diplomasEarned: 2 });
    expect(moreProgress(local, cloud)).toBe('local');
  });

  it('identifies mixed state when offline earnings inflate coins on shorter play time', () => {
    // Exactly the incident scenario:
    // Device A (e.g. mobile) stayed closed, collected offline coins (more lifetime coins),
    // but Device B (cloud / PC) has more active play time and diplomas.
    const local = sample({
      lifetimeCoins: '50000', // more coins due to offline gain
      diplomasEarned: 1,
      playSeconds: 600, // only 10 minutes played
    });
    const cloud = sample({
      lifetimeCoins: '20000',
      diplomasEarned: 10, // 10 diplomas
      playSeconds: 7200, // 2 hours played
    });
    expect(moreProgress(local, cloud)).toBe('mixed');
  });

  it('identifies mixed state when one save has more achievements and the other has more play time', () => {
    const local = sample({ achievements: 10, playSeconds: 500 });
    const cloud = sample({ achievements: 2, playSeconds: 2000 });
    expect(moreProgress(local, cloud)).toBe('mixed');
  });
});
