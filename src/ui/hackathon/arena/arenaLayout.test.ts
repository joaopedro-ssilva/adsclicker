import { describe, expect, it } from 'vitest';
import { enemyFootprint, pickScale, slotPosition } from './arenaLayout';

describe('arena layout', () => {
  it('counts only the two widest enemies of a crowded wave', () => {
    const crowded = enemyFootprint({ waves: [['bug', 'bug', 'bug']] });
    const pair = enemyFootprint({ waves: [['bug', 'bug']] });
    expect(crowded.w).toBe(pair.w);
  });

  it('never goes below 1 nor above 4, and always picks a whole number', () => {
    const stage = { waves: [['bug']] };
    expect(pickScale({ width: 100, height: 100 }, stage)).toBe(1);
    expect(pickScale({ width: 4000, height: 4000 }, stage)).toBe(4);
    expect(Number.isInteger(pickScale({ width: 390, height: 270 }, stage))).toBe(true);
  });

  it('fits the boss and the student side by side on a phone-sized box', () => {
    const scale = pickScale({ width: 390, height: 280 }, { waves: [['deploy-de-sexta']] });
    expect(scale).toBeGreaterThanOrEqual(1);
    expect((60 + 16 + 95) * scale).toBeLessThanOrEqual(390);
  });

  it('puts a lone enemy in the middle and extras around it', () => {
    expect(slotPosition(0, 1).x).toBe(0.5);
    expect(slotPosition(1, 1).x).not.toBe(0.5);
  });
});
