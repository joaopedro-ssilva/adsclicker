import { describe, expect, it } from 'vitest';
import { acceptSprint, buyDiscipline, hitInvasion } from './actions';
import { click } from './click';
import { advance } from './tick';
import { coins, eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

const never = () => 0.99;
const always = () => 0;

function withSprint(offers: string[]) {
  const g = newCleanGame();
  hire(g.state, 'b1');
  g.state.sprint.offers = offers;
  return g;
}

describe('offers', () => {
  it('offers three eligible sprints once the feature is on', () => {
    const g = newCleanGame();
    advance(g.state, g.content, T0 + 1000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual([]);

    hire(g.state, 'b1');
    advance(g.state, g.content, T0 + 2000, g.rng, g.emit);
    const offers = g.state.sprint.offers;
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
    expect(offers).not.toContain('spr-defend'); // needs Wagner
    expect(eventsOf(g.events, 'sprintOffers')).toHaveLength(1);
  });

  it('includes sprints whose requirements are met', () => {
    const g = newCleanGame((c) => {
      c.sprints = c.sprints.filter((s) => s.id === 'spr-defend');
    });
    hire(g.state, 'b1');
    advance(g.state, g.content, T0 + 1000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual([]);
    hire(g.state, 'wagner');
    advance(g.state, g.content, T0 + 2000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual(['spr-defend']);
  });

  it('keeps the offers until one is accepted, then drops the others', () => {
    const g = withSprint(['spr-clicks', 'spr-buy', 'spr-earn']);
    advance(g.state, g.content, T0 + 30_000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual(['spr-clicks', 'spr-buy', 'spr-earn']);
    expect(acceptSprint(g.state, g.content, 'spr-buy', T0 + 30_000, g.emit)).toBe(true);
    expect(g.state.sprint.offers).toEqual([]);
    expect(g.state.sprint.active).toMatchObject({ def: 'spr-buy', startedAt: T0 + 30_000, endsAt: T0 + 90_000, progress: 0, target: 3 });
    expect(eventsOf(g.events, 'sprintStart')).toEqual([{ type: 'sprintStart', def: 'spr-buy' }]);
  });

  it('refuses sprints that are not on offer, a second sprint, and a missing feature', () => {
    const g = withSprint(['spr-clicks', 'spr-buy']);
    expect(acceptSprint(g.state, g.content, 'spr-crits', T0, g.emit)).toBe(false);
    expect(acceptSprint(g.state, g.content, 'nope', T0, g.emit)).toBe(false);
    acceptSprint(g.state, g.content, 'spr-clicks', T0, g.emit);
    expect(acceptSprint(g.state, g.content, 'spr-buy', T0, g.emit)).toBe(false);

    const h = withSprint(['spr-clicks']);
    h.state.hired.b1 = false;
    expect(acceptSprint(h.state, h.content, 'spr-clicks', T0, h.emit)).toBe(false);
  });
});

describe('goals', () => {
  it('clicks: completes after N clicks and pays the reward', () => {
    const g = withSprint(['spr-clicks']);
    acceptSprint(g.state, g.content, 'spr-clicks', T0, g.emit);
    for (let i = 0; i < 9; i += 1) click(g.state, g.content, T0 + i * 300, never, g.emit);
    expect(g.state.sprint.active?.progress).toBe(9);
    const before = g.state.coins;
    click(g.state, g.content, T0 + 3000, never, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsCompleted).toBe(1);
    expect(g.state.sprint.nextOffersAt).toBe(T0 + 3000 + 60_000);
    expect(g.state.sprint.offers).toEqual([]);
    // reward: floor of 10 clicks (no production), on top of the click itself
    expect(num(g.state.coins.sub(before))).toBeGreaterThanOrEqual(10);
    const [done] = eventsOf(g.events, 'sprintDone');
    expect(done).toMatchObject({ def: 'spr-clicks', reward: { kind: 'coins' } });
  });

  it('crits: counts only critical clicks', () => {
    const g = withSprint(['spr-crits']);
    acceptSprint(g.state, g.content, 'spr-crits', T0, g.emit);
    click(g.state, g.content, T0, never, g.emit);
    expect(g.state.sprint.active?.progress).toBe(0);
    click(g.state, g.content, T0 + 100, always, g.emit);
    click(g.state, g.content, T0 + 200, always, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });

  it('reachCombo: tracks the highest combo reached', () => {
    const g = withSprint(['spr-combo']);
    acceptSprint(g.state, g.content, 'spr-combo', T0, g.emit);
    for (let i = 0; i < 5; i += 1) click(g.state, g.content, T0 + i * 100, never, g.emit);
    expect(g.state.sprint.active?.progress).toBe(4);
    click(g.state, g.content, T0 + 500, never, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });

  it('buyLevels: counts purchased levels', () => {
    const g = withSprint(['spr-buy']);
    coins(g.state, 1e6);
    acceptSprint(g.state, g.content, 'spr-buy', T0, g.emit);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(g.state.sprint.active?.progress).toBe(2);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(g.state.sprint.active).toBeNull();
  });

  it('defendEvents: counts defended invasions', () => {
    const g = withSprint(['spr-defend']);
    hire(g.state, 'wagner');
    g.state.nextInvasionAt = T0 + 1;
    advance(g.state, g.content, T0 + 1000, () => 0, g.emit);
    // advance may have offered nothing new: the sprint is accepted on offer from the state
    acceptSprint(g.state, g.content, 'spr-defend', T0 + 1000, g.emit);
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 2000, () => 0, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });

  it('earnSeconds: needs coins worth N seconds of the production at the start', () => {
    const g = withSprint(['spr-earn']);
    g.state.levels['cafe'] = 10; // 30/s -> 30 seconds = 900 coins
    acceptSprint(g.state, g.content, 'spr-earn', T0, g.emit);
    expect(g.state.sprint.active?.refCps).toBeDefined();
    advance(g.state, g.content, T0 + 20_000, g.rng, g.emit);
    expect(g.state.sprint.active?.progress).toBeCloseTo(20, 4);
    advance(g.state, g.content, T0 + 31_000, g.rng, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });

  it('earnSeconds: works from clicks alone when there is no production', () => {
    const g = withSprint(['spr-earn']);
    acceptSprint(g.state, g.content, 'spr-earn', T0, g.emit);
    for (let i = 0; i < 40; i += 1) click(g.state, g.content, T0 + i * 1500, never, g.emit); // no combo: 1 coin each
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });
});

describe('deadline', () => {
  it('fails when the time runs out', () => {
    const g = withSprint(['spr-clicks']);
    acceptSprint(g.state, g.content, 'spr-clicks', T0, g.emit);
    click(g.state, g.content, T0 + 100, never, g.emit);
    advance(g.state, g.content, T0 + 59_999, g.rng, g.emit);
    expect(g.state.sprint.active).not.toBeNull();
    advance(g.state, g.content, T0 + 60_000, g.rng, g.emit);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsFailed).toBe(1);
    expect(g.state.counters.sprintsCompleted).toBe(0);
    expect(eventsOf(g.events, 'sprintFailed')).toEqual([{ type: 'sprintFailed', def: 'spr-clicks' }]);
  });

  it('puts new offers up after the cooldown', () => {
    const g = withSprint(['spr-clicks']);
    acceptSprint(g.state, g.content, 'spr-clicks', T0, g.emit);
    advance(g.state, g.content, T0 + 60_000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual([]);
    advance(g.state, g.content, T0 + 119_000, g.rng, g.emit);
    expect(g.state.sprint.offers).toEqual([]);
    advance(g.state, g.content, T0 + 120_000, g.rng, g.emit);
    expect(g.state.sprint.offers.length).toBeGreaterThan(0);
  });

  it('fails even when the deadline falls inside one huge step, ignoring what came after', () => {
    const g = withSprint(['spr-earn']);
    g.state.levels['cafe'] = 10;
    acceptSprint(g.state, g.content, 'spr-earn', T0, g.emit);
    g.state.sprint.active!.target = 1e9; // unreachable
    advance(g.state, g.content, T0 + 3_600_000, g.rng, g.emit);
    expect(g.state.counters.sprintsFailed).toBe(1);
  });

  it('completes in time even inside one huge step', () => {
    const g = withSprint(['spr-earn']);
    g.state.levels['cafe'] = 10;
    acceptSprint(g.state, g.content, 'spr-earn', T0, g.emit);
    advance(g.state, g.content, T0 + 3_600_000, g.rng, g.emit);
    expect(g.state.counters.sprintsCompleted).toBe(1);
    expect(g.state.counters.sprintsFailed).toBe(0);
  });
});
