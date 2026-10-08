import { describe, expect, it } from 'vitest';
import { enemyFootprint, pickScale, slotPosition } from './arenaLayout';

describe('arena layout', () => {
  it('counts only the two widest enemies of a crowded wave', () => {
    const crowded = enemyFootprint({ waves: [['bug', 'bug', 'bug']] });
    const pair = enemyFootprint({ waves: [['bug', 'bug']] });
    expect(crowded.w).toBe(pair.w);
  });

  it('never goes below 1 nor above 6, and always picks a whole number', () => {
    const stage = { waves: [['bug']] };
    expect(pickScale({ width: 100, height: 100 }, stage)).toBe(1);
    expect(pickScale({ width: 4000, height: 4000 }, stage)).toBe(6);
    expect(Number.isInteger(pickScale({ width: 390, height: 270 }, stage))).toBe(true);
  });

  it('fits the boss and the student side by side on a phone-sized box', () => {
    const scale = pickScale({ width: 390, height: 280 }, { waves: [['deploy-de-sexta']] });
    expect(scale).toBeGreaterThanOrEqual(1);
    expect((60 + 16 + 95) * scale).toBeLessThanOrEqual(390);
  });

  it('gives each side its own half of a wide field', () => {
    const stage = { waves: [['bug', 'bug']] };
    const scale = pickScale({ width: 1440, height: 640 }, stage);
    const { w } = enemyFootprint(stage);
    expect(scale).toBeGreaterThanOrEqual(3);
    expect(60 * scale).toBeLessThanOrEqual(720 * 0.9);
    expect(w * scale).toBeLessThanOrEqual(720 * 0.96);
  });

  it('shrinks with the height of the field, not only its width', () => {
    const stage = { waves: [['deploy-de-sexta']] };
    expect(pickScale({ width: 1440, height: 300 }, stage)).toBeLessThan(pickScale({ width: 1440, height: 640 }, stage));
  });

  it('puts a lone enemy in the middle and extras around it', () => {
    expect(slotPosition(0, 1).x).toBe(0.5);
    expect(slotPosition(1, 1).x).not.toBe(0.5);
  });
});
