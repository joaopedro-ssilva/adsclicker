import { describe, expect, it } from 'vitest';
import { applyOffline } from './offline';
import { advance } from './tick';
import { eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

const HOUR = 3_600_000;

function withGladimir() {
  const g = newCleanGame();
  hire(g.state, 'gladimir');
  g.state.levels['cafe'] = 10; // 30/s with Edécio on stage
  return g;
}

describe('offline earnings', () => {
  it('pays coins/second x time x 50% after a short absence', () => {
    const g = withGladimir();
    const report = applyOffline(g.state, g.content, T0 + HOUR, g.emit);
    expect(report).not.toBeNull();
    expect(num(report!.coins)).toBeCloseTo(30 * 3600 * 0.5, 2);
    expect(report!.awayMs).toBe(HOUR);
    expect(report!.countedMs).toBe(HOUR);
    expect(num(g.state.coins)).toBeCloseTo(54_000, 2);
    expect(num(g.state.lifetimeCoins)).toBeCloseTo(54_000, 2);
    expect(g.state.lastTickAt).toBe(T0 + HOUR);
    expect(g.state.counters.offlineCollections).toBe(1);
    expect(eventsOf(g.events, 'offline')).toHaveLength(1);
    expect(eventsOf(g.events, 'offline')[0]).toMatchObject({ awayMs: HOUR });
  });

  it('caps the counted time at offlineHours (2 h by default)', () => {
    const g = withGladimir();
    const report = applyOffline(g.state, g.content, T0 + 10 * HOUR, g.emit)!;
    expect(report.awayMs).toBe(10 * HOUR);
    expect(report.countedMs).toBe(2 * HOUR);
    expect(num(report.coins)).toBeCloseTo(30 * 2 * 3600 * 0.5, 2);
  });

  it('reaches 12 h at 100% with research', () => {
    const g = withGladimir();
    g.state.research['r-offline'] = true;
    const report = applyOffline(g.state, g.content, T0 + 20 * HOUR, g.emit)!;
    expect(report.countedMs).toBe(12 * HOUR);
    expect(num(report.coins)).toBeCloseTo(30 * 12 * 3600, 1);
  });

  it('pays nothing without the offline feature (no Gladimir)', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10;
    expect(applyOffline(g.state, g.content, T0 + HOUR, g.emit)).toBeNull();
    expect(num(g.state.coins)).toBe(0);
    expect(g.state.lastTickAt).toBe(T0 + HOUR); // the time is consumed, not paid later
    expect(eventsOf(g.events, 'offline')).toHaveLength(0);
  });

  it('leaves absences shorter than minAwayMs to the normal tick', () => {
    const g = withGladimir();
    expect(applyOffline(g.state, g.content, T0 + 59_000, g.emit)).toBeNull();
    expect(g.state.lastTickAt).toBe(T0);
    expect(num(g.state.coins)).toBe(0);
    advance(g.state, g.content, T0 + 59_000, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(30 * 59, 4); // full rate, no cap
  });

  it('pays from coins/second with no production as nothing', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    expect(applyOffline(g.state, g.content, T0 + HOUR, g.emit)).toBeNull();
  });

  it('ends buffs and clears the invasion and combo without penalty, and pauses the sprint', () => {
    const g = withGladimir();
    g.state.buffs.push({
      id: 'buff-scale',
      name: 'x',
      emoji: 'x',
      effects: [{ stat: 'idlePower', op: 'mult', value: 100 }],
      startedAt: T0,
      endsAt: T0 + 10 * HOUR,
      source: 'ability',
    });
    g.state.invasion = { uid: 1, def: 'phishing', spawnedAt: T0, expiresAt: T0 + 10_000, clicksLeft: 3, x: 0.5, y: 0.5 };
    g.state.eventStreak = 5;
    g.state.combo = { steps: 10, lastClickAt: T0 };
    g.state.sprint.active = { def: 'spr-clicks', startedAt: T0 - 10_000, endsAt: T0 + 20_000, progress: 3, target: 10 };

    const report = applyOffline(g.state, g.content, T0 + HOUR, g.emit)!;
    expect(num(report.coins)).toBeCloseTo(30 * 3600 * 0.5, 2); // the x100 buff is not counted
    expect(g.state.buffs).toEqual([]);
    expect(g.state.invasion).toBeNull();
    expect(g.state.eventStreak).toBe(5);
    expect(g.state.counters.eventsMissed).toBe(0);
    expect(g.state.combo.steps).toBe(0);
    expect(g.state.sprint.active).toMatchObject({ endsAt: T0 + 20_000 + HOUR, progress: 3 });
  });

  it('does not pay twice for the same absence', () => {
    const g = withGladimir();
    applyOffline(g.state, g.content, T0 + HOUR, g.emit);
    expect(applyOffline(g.state, g.content, T0 + HOUR, g.emit)).toBeNull();
    expect(g.state.counters.offlineCollections).toBe(1);
  });
});
