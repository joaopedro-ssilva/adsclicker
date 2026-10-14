import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { PROFESSOR_IDS } from '../content/types';
import type { Emit } from '../store/types';
import { click, graduate } from './actions';
import { Decimal } from './decimal';
import { createInitialState } from './init';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { advance } from './tick';

const T0 = 1_700_000_000_000;

function game() {
  const emit: Emit = () => undefined;
  return { state: createInitialState(content, T0), emit, rng: createRng(5) };
}

/** A state that can graduate, with a few clicks and some production behind it. */
function readyToGraduate() {
  const g = game();
  g.state.levels[content.disciplines[0]!.id] = 10;
  click(g.state, content, T0, g.rng, g.emit);
  click(g.state, content, T0 + 100, g.rng, g.emit);
  advance(g.state, content, T0 + 5_000, g.rng, g.emit);
  for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
  return g;
}

describe('run summary', () => {
  it('splits the run coins into parts that add up to what was paid', () => {
    const g = readyToGraduate();
    g.state.runCoins = g.state.runCoins.add('8e20');
    g.state.run.eventCoins = new Decimal('1e18');
    g.state.run.sprintCoins = new Decimal('2e18');
    g.state.run.offlineCoins = new Decimal('3e18');
    g.state.run.autoClickCoins = new Decimal('5e17');
    g.state.run.clickCoins = g.state.run.clickCoins.add('5e17');
    const total = g.state.runCoins;
    expect(graduate(g.state, content, T0 + 6_000, g.emit)).toBe(true);

    const summary = g.state.lastRun!.summary!;
    const sum = (['classes', 'clicks', 'autoClicks', 'events', 'sprints', 'offline', 'other'] as const).reduce(
      (acc, key) => acc.add(summary.coins[key]),
      new Decimal(0),
    );
    expect(new Decimal(summary.coins.total).eq(total)).toBe(true);
    expect(sum.sub(total).abs().div(total).toNumber()).toBeLessThan(1e-9);
    expect(summary.diplomas).toBeGreaterThan(0);
    expect(g.state.lastRun!.clicks).toBe(2);
    expect(g.state.run.eventCoins.eq(0)).toBe(true);
  });

  it('starts the records on the first graduation and reports only the ones a later run beats', () => {
    const g = readyToGraduate();
    g.state.runCoins = g.state.runCoins.add('8e20');
    graduate(g.state, content, T0 + 6_000, g.emit);
    const first = g.state.lastRun!.summary!;
    expect(first.recordsBeaten).toEqual([]);
    expect(first.recordsStarted).toContain('mostClicks');
    expect(first.recordsStarted).toContain('mostCoins');
    expect(g.state.records.mostClicks).toBe(2);

    // A second, bigger run in the same time: more clicks and more coins beat the marks.
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    g.state.run.seconds = 3;
    g.state.run.clicks = 9;
    g.state.run.maxCombo = 4;
    g.state.runCoins = new Decimal('9e22');
    graduate(g.state, content, T0 + 7_000, g.emit);
    const second = g.state.lastRun!.summary!;
    expect(second.recordsBeaten).toContain('mostClicks');
    expect(second.recordsBeaten).toContain('mostCoins');
    expect(g.state.records.mostClicks).toBe(9);
  });

  it('round-trips and loads an old save without records or summary', () => {
    const g = readyToGraduate();
    g.state.runCoins = g.state.runCoins.add('8e20');
    graduate(g.state, content, T0 + 6_000, g.emit);
    const back = deserializeState(serializeState(g.state), content, T0)!;
    expect(back.records.mostClicks).toBe(2);
    expect(back.records.mostCoins.eq(g.state.records.mostCoins)).toBe(true);
    expect(back.lastRun?.summary).toEqual(g.state.lastRun?.summary);

    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.records;
    delete (raw.lastRun as Record<string, unknown>).summary;
    delete (raw.run as Record<string, unknown>).maxCombo;
    const old = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(old.records.mostClicks).toBe(0);
    expect(old.records.mostCoins.eq(0)).toBe(true);
    expect(old.lastRun?.summary).toBeUndefined();
    expect(old.run.maxCombo).toBe(0);
    expect(old.run.eventCoins.eq(0)).toBe(true);
  });
});
