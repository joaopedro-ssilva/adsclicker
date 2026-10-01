import { describe, expect, it } from 'vitest';
import { createFixtureContent } from '../engine/__fixtures__/content';
import { simulate } from './simulate';

describe('simulate', () => {
  it('plays the fixture content and reports the early milestones', () => {
    const result = simulate(createFixtureContent(), { maxSeconds: 1800, seed: 2, graduate: false });
    const byId = Object.fromEntries(result.milestones.map((m) => [m.id, m.reachedAt]));
    expect(byId['firstUpgrade']).not.toBeNull();
    expect(byId['firstUpgrade']!).toBeLessThan(30);
    expect(byId['gladimir']).not.toBeNull();
    expect(byId['gladimir']!).toBeGreaterThan(byId['firstUpgrade']!);
    expect(result.finalState.lifetimeCoins.gt(1000)).toBe(true);
    expect(result.seconds).toBeLessThanOrEqual(1800);
  });

  it('is deterministic for a seed', () => {
    const run = () => simulate(createFixtureContent(), { maxSeconds: 600, seed: 5 });
    const a = run();
    const b = run();
    expect(a.milestones).toEqual(b.milestones);
    expect(a.finalState.lifetimeCoins.toString()).toBe(b.finalState.lifetimeCoins.toString());
  });

  it('earns more with a faster clicker', () => {
    const slow = simulate(createFixtureContent(), { maxSeconds: 20, clicksPerSecond: 1, graduate: false });
    const fast = simulate(createFixtureContent(), { maxSeconds: 20, clicksPerSecond: 8, graduate: false });
    expect(fast.finalState.lifetimeCoins.gt(slow.finalState.lifetimeCoins)).toBe(true);
  });

  it('samples a timeline', () => {
    const result = simulate(createFixtureContent(), { maxSeconds: 700, sampleSeconds: 300, stopWhenDone: false });
    expect(result.timeline.length).toBeGreaterThanOrEqual(3);
    expect(result.timeline.at(-1)!.seconds).toBeGreaterThanOrEqual(699);
  });

  it('can graduate and keep playing', () => {
    const content = createFixtureContent();
    const result = simulate(content, { maxSeconds: 4 * 3600, seed: 3, graduateMinDiplomas: 1 });
    expect(result.finalState.counters.graduations).toBeGreaterThan(0);
    expect(result.finalState.diplomasEarned).toBeGreaterThan(0);
  });
});
