import { describe, expect, it } from 'vitest';
import { hitInvasion } from './actions';
import { advance } from './tick';
import { coins, eventsOf, hire, newCleanGame, num, sequence, T0 } from './__fixtures__/helpers';

/** rng that always returns 0: shortest interval, first invasion, top-left of the stage. */
const zero = () => 0;

function withWagner() {
  const g = newCleanGame();
  hire(g.state, 'wagner');
  return g;
}

describe('invasion scheduling and spawning', () => {
  it('does nothing without the events feature', () => {
    const g = newCleanGame();
    advance(g.state, g.content, T0 + 1_000_000, zero, g.emit);
    expect(g.state.invasion).toBeNull();
    expect(g.state.nextInvasionAt).toBe(0);
  });

  it('schedules the first invasion 75 to 150 s after the feature turns on', () => {
    const g = withWagner();
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    expect(g.state.nextInvasionAt).toBe(T0 + 1000 + 75_000);

    const h = withWagner();
    advance(h.state, h.content, T0 + 1000, () => 1, h.emit);
    expect(h.state.nextInvasionAt).toBe(T0 + 1000 + 150_000);
  });

  it('spawns on schedule with a weighted pick and a position on the stage', () => {
    const g = withWagner();
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    advance(g.state, g.content, T0 + 80_000, zero, g.emit);
    const invasion = g.state.invasion;
    expect(invasion).not.toBeNull();
    expect(invasion).toMatchObject({ uid: 1, def: 'phishing', clicksLeft: 3, spawnedAt: T0 + 80_000 });
    expect(invasion!.expiresAt).toBe(T0 + 80_000 + 10_000);
    expect(invasion!.x).toBeGreaterThanOrEqual(0);
    expect(invasion!.x).toBeLessThanOrEqual(1);
    expect(eventsOf(g.events, 'invasionSpawn')).toEqual([{ type: 'invasionSpawn', uid: 1, def: 'phishing' }]);
  });

  it('picks by weight', () => {
    const g = withWagner();
    g.state.nextInvasionAt = T0 + 1;
    // weights 3 and 1: a roll of 0.9 x 4 = 3.6 lands on the second
    advance(g.state, g.content, T0 + 1000, sequence(0.9, 0.5, 0.5), g.emit);
    expect(g.state.invasion?.def).toBe('ddos');
  });

  it('never has two at once and numbers each spawn', () => {
    const g = withWagner();
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    const first = g.state.invasion;
    advance(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(g.state.invasion).toBe(first);
    expect(eventsOf(g.events, 'invasionSpawn')).toHaveLength(1);
  });

  it('scales the interval and the window with eventInterval and eventWindow', () => {
    const g = newCleanGame((c) => {
      c.research.push({
        id: 'slow',
        professor: 'wagner',
        name: 'x',
        emoji: 'x',
        description: 'x',
        cost: '1',
        effects: [
          { stat: 'eventInterval', op: 'mult', value: 0.5 },
          { stat: 'eventWindow', op: 'mult', value: 2 },
        ],
        requires: [],
      });
    });
    hire(g.state, 'wagner');
    g.state.research['slow'] = true;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    expect(g.state.nextInvasionAt).toBe(T0 + 1000 + 37_500);
    advance(g.state, g.content, T0 + 50_000, zero, g.emit);
    expect(g.state.invasion!.expiresAt - g.state.invasion!.spawnedAt).toBe(20_000);
  });
});

describe('defending', () => {
  function spawned() {
    const g = withWagner();
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    return g;
  }

  it('needs all the required clicks, then pays the reward and raises the streak', () => {
    const g = spawned();
    const now = T0 + 2000;
    hitInvasion(g.state, g.content, now, zero, g.emit);
    hitInvasion(g.state, g.content, now, zero, g.emit);
    expect(g.state.invasion?.clicksLeft).toBe(1);
    expect(eventsOf(g.events, 'invasionHit').map((e) => e.clicksLeft)).toEqual([2, 1]);
    expect(num(g.state.coins)).toBe(0);

    hitInvasion(g.state, g.content, now, zero, g.emit);
    expect(g.state.invasion).toBeNull();
    expect(g.state.eventStreak).toBe(1);
    expect(g.state.counters.eventsDefended).toBe(1);
    expect(g.state.counters.bestEventStreak).toBe(1);
    // no production yet: the reward falls back to the floor, 10 clicks
    expect(num(g.state.coins)).toBe(10);
    const [defended] = eventsOf(g.events, 'invasionDefended');
    expect(defended).toMatchObject({ def: 'phishing', streak: 1 });
    expect(defended!.reward.kind).toBe('coins');
  });

  it('pays seconds x coins/second when that beats the floor, times eventReward', () => {
    const g = spawned();
    g.state.levels['cafe'] = 10; // 30/s -> 60 s = 1800
    g.state.prestige['events-reward'] = 1; // x2
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(3600, 4);
  });

  it('schedules the next invasion after a defence', () => {
    const g = spawned();
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(g.state.nextInvasionAt).toBe(T0 + 2000 + 75_000);
  });

  it('can pay a buff instead of coins', () => {
    const g = withWagner();
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, sequence(0.9, 0.5, 0.5), g.emit); // ddos
    for (let i = 0; i < 5; i += 1) hitInvasion(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(g.state.buffs.map((b) => b.id)).toEqual(['buff-ddos']);
    expect(g.state.buffs[0]).toMatchObject({ source: 'invasion', endsAt: T0 + 2000 + 30_000 });
    const [defended] = eventsOf(g.events, 'invasionDefended');
    expect(defended!.reward).toMatchObject({ kind: 'buff', buffId: 'buff-ddos', durationMs: 30_000 });
    expect(eventsOf(g.events, 'buffStart')).toHaveLength(1);
  });

  it('cannot be hit when nothing is on stage or after it expired', () => {
    const g = withWagner();
    expect(hitInvasion(g.state, g.content, T0, zero, g.emit)).toBe(false);
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    expect(hitInvasion(g.state, g.content, T0 + 1000 + 10_000, zero, g.emit)).toBe(false);
  });
});

describe('missing', () => {
  it('counts as missed after the window and resets the streak', () => {
    const g = withWagner();
    g.state.eventStreak = 4;
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    const uid = g.state.invasion!.uid;
    advance(g.state, g.content, T0 + 1000 + 10_000, zero, g.emit);
    expect(g.state.invasion).toBeNull();
    expect(g.state.eventStreak).toBe(0);
    expect(g.state.counters.eventsMissed).toBe(1);
    expect(eventsOf(g.events, 'invasionMissed')).toEqual([{ type: 'invasionMissed', uid, def: 'phishing' }]);
    expect(g.state.nextInvasionAt).toBe(T0 + 11_000 + 75_000);
  });

  it('keeps the best streak counter', () => {
    const g = withWagner();
    g.state.eventStreak = 7;
    g.state.counters.bestEventStreak = 9;
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(g.state.eventStreak).toBe(8);
    expect(g.state.counters.bestEventStreak).toBe(9);
  });
});

describe('coins check', () => {
  it('reads coins only after the reward, never loses them', () => {
    const g = withWagner();
    coins(g.state, 100);
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, zero, g.emit);
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 2000, zero, g.emit);
    expect(num(g.state.coins)).toBe(110);
  });
});
