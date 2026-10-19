import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { PROFESSOR_IDS } from '../content/types';
import type { Condition, ProfessorId } from '../content/types';
import { measureCondition } from './achievements';
import { defendPostdoc, graduate } from './actions';
import { Decimal } from './decimal';
import { createInitialState } from './init';
import { masteryView } from './mastery';
import { canDefendPostdoc, postdocPrice, postdocTotalPrice, postdocView, totalPostdocStars } from './postdoc';
import { deserializeState, serializeState } from './save';
import type { GameState } from './state';
import { computeStats } from './stats';
import type { Emit, GameEvent } from '../store/types';

const T0 = 1_700_000_000_000;

function game() {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  return { state: createInitialState(content, T0), events, emit };
}

/** Hires the professor with `total` levels over their disciplines (1,000 = Domínio 40). */
function setLevels(state: GameState, professor: ProfessorId, total: number): void {
  state.hired[professor] = true;
  const defs = content.disciplines.filter((def) => def.professor === professor);
  const each = Math.floor(total / defs.length);
  defs.forEach((def, i) => {
    state.levels[def.id] = each + (i === 0 ? total - each * defs.length : 0);
  });
}

const rich = (state: GameState) => {
  state.coins = new Decimal('1e60');
  state.lifetimeCoins = new Decimal('1e60');
};

describe('Pós-doc price', () => {
  it('starts at 1e30 and grows x1000 per star', () => {
    expect(postdocPrice(content, 0).eq('1e30')).toBe(true);
    expect(postdocPrice(content, 1).eq('1e33')).toBe(true);
    expect(postdocPrice(content, 4).eq('1e42')).toBe(true);
    expect(postdocTotalPrice(content, 5).div('1e42').toNumber()).toBeCloseTo(1.001001, 5);
  });
});

describe('Pós-doc rule', () => {
  it('needs the Domínio at the cap, a hired professor and the coins', () => {
    const g = game();
    rich(g.state);
    setLevels(g.state, 'pablo', 999);
    expect(postdocView(g.state, content, 'pablo').blocked).toBe('notMaxed');
    setLevels(g.state, 'pablo', 1000);
    g.state.coins = new Decimal('1e29');
    expect(postdocView(g.state, content, 'pablo').blocked).toBe('broke');
    expect(defendPostdoc(g.state, content, 'pablo', T0, g.emit)).toBe(false);
    g.state.coins = new Decimal('1e31');
    g.state.hired.pablo = false;
    expect(postdocView(g.state, content, 'pablo').blocked).toBe('notHired');
    g.state.hired.pablo = true;
    expect(canDefendPostdoc(g.state, content, 'pablo')).toBe(true);
  });

  it('pays, gives the star and counts it, once per turma', () => {
    const g = game();
    rich(g.state);
    g.state.coins = new Decimal('5e30');
    setLevels(g.state, 'pablo', 1000);
    expect(defendPostdoc(g.state, content, 'pablo', T0, g.emit)).toBe(true);
    expect(g.state.postdoc.stars.pablo).toBe(1);
    expect(g.state.counters.postdocs).toBe(1);
    expect(g.state.coins.div('4e30').toNumber()).toBeCloseTo(1, 5);
    expect(g.events).toContainEqual({ type: 'postdoc', professor: 'pablo', stars: 1 });
    // The levels stay; the second star waits for another turma.
    expect(masteryView(g.state, content, 'pablo').rank).toBe(40);
    g.state.coins = new Decimal('1e60');
    expect(postdocView(g.state, content, 'pablo').blocked).toBe('defendedThisTurma');
    expect(defendPostdoc(g.state, content, 'pablo', T0, g.emit)).toBe(false);
  });

  it('stops at five stars', () => {
    const g = game();
    rich(g.state);
    setLevels(g.state, 'b1', 1000);
    g.state.postdoc.stars.b1 = 5;
    expect(postdocView(g.state, content, 'b1')).toMatchObject({ blocked: 'maxStars', price: null });
  });

  it('keeps the stars through a graduation, asks for the cap again and opens the next defence', () => {
    const g = game();
    rich(g.state);
    g.state.runCoins = new Decimal('1e60');
    setLevels(g.state, 'edecio', 1000);
    expect(defendPostdoc(g.state, content, 'edecio', T0, g.emit)).toBe(true);
    g.state.hired.angelo = true; // the graduation feature
    expect(graduate(g.state, content, T0, g.emit)).toBe(true);
    expect(g.state.postdoc.stars.edecio).toBe(1);
    expect(g.state.counters.postdocs).toBe(1);
    // The new turma starts without levels: the cap has to be earned again.
    g.state.coins = new Decimal('5e33');
    expect(postdocView(g.state, content, 'edecio')).toMatchObject({ stars: 1, blocked: 'notMaxed' });
    setLevels(g.state, 'edecio', 1000);
    expect(postdocView(g.state, content, 'edecio').blocked).toBeNull();
    expect(defendPostdoc(g.state, content, 'edecio', T0, g.emit)).toBe(true);
    expect(g.state.postdoc.stars.edecio).toBe(2);
    // The second star cost x1000.
    expect(g.state.coins.div('4e33').toNumber()).toBeCloseTo(1, 5);
  });
});

describe('Pós-doc effect', () => {
  it('makes the Domínio bonus 10% stronger per star', () => {
    const g = game();
    setLevels(g.state, 'b2', 1000);
    const base = computeStats(g.state, content).costMult;
    expect(base).toBeCloseTo(0.99 ** 40, 10);
    g.state.postdoc.stars.b2 = 2;
    expect(computeStats(g.state, content).costMult).toBeCloseTo(0.99 ** 48, 10);
    g.state.postdoc.stars.b2 = 5;
    expect(computeStats(g.state, content).costMult).toBeCloseTo(0.99 ** 60, 10);
  });

  it('scales additive Domínio effects and the line shown in the view', () => {
    const g = game();
    setLevels(g.state, 'wagner', 1000);
    const plain = computeStats(g.state, content).eventReward;
    expect(plain).toBeCloseTo(1 + 0.025 * 40, 10);
    g.state.postdoc.stars.wagner = 1;
    expect(computeStats(g.state, content).eventReward).toBeCloseTo(1 + 0.025 * 44, 10);
    expect(masteryView(g.state, content, 'wagner').stars).toBe(1);
    expect(masteryView(g.state, content, 'wagner').line).toContain('110');
  });

  it('does nothing for a professor who is not hired', () => {
    const g = game();
    g.state.postdoc.stars.guto = 5;
    expect(computeStats(g.state, content).abilityCooldown).toBe(1);
  });
});

describe('Pós-doc counters for the achievements', () => {
  it('measures stars of one professor, of some of them and in total', () => {
    const g = game();
    g.state.postdoc.stars.pablo = 5;
    g.state.postdoc.stars.b1 = 1;
    expect(totalPostdocStars(g.state)).toBe(6);
    const probe = { coinsPerSecond: () => new Decimal(0), clickValue: () => new Decimal(0) };
    const reached = (condition: Condition) => measureCondition(g.state, content, condition, probe).met;
    expect(reached({ kind: 'postdoc', stars: 5, professor: 'pablo' })).toBe(true);
    expect(reached({ kind: 'postdoc', stars: 5, professor: 'b1' })).toBe(false);
    expect(reached({ kind: 'postdoc', stars: 1, count: 2 })).toBe(true);
    expect(reached({ kind: 'postdoc', stars: 1 })).toBe(false);
    expect(reached({ kind: 'postdocTotal', gte: 6 })).toBe(true);
    for (const id of PROFESSOR_IDS) g.state.postdoc.stars[id] = 1;
    expect(reached({ kind: 'postdoc', stars: 1 })).toBe(true);
  });
});

describe('Pós-doc save', () => {
  it('round-trips and reads old saves as no stars', () => {
    const g = game();
    g.state.postdoc.stars.pablo = 3;
    g.state.postdoc.turma.pablo = 4;
    const back = deserializeState(serializeState(g.state), content, T0)!;
    expect(back.postdoc.stars.pablo).toBe(3);
    expect(back.postdoc.turma.pablo).toBe(4);
    expect(back.postdoc.stars.edecio).toBe(0);

    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.postdoc;
    const old = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(PROFESSOR_IDS.every((id) => old.postdoc.stars[id] === 0)).toBe(true);
    expect(old.counters.postdocs).toBe(0);
  });

  it('clamps forged values', () => {
    const g = game();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    raw.postdoc = { stars: { pablo: 99, b1: -3, guto: 'x', edecio: 2.7 }, turma: { pablo: -1 } };
    const back = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(back.postdoc.stars).toMatchObject({ pablo: 5, b1: 0, guto: 0, edecio: 2 });
    expect(back.postdoc.turma.pablo).toBeUndefined();
  });
});
