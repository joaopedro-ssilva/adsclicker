import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { graduate } from '../actions';
import { hire, newCleanGame, T0 } from '../__fixtures__/helpers';
import type { TestGame } from '../__fixtures__/helpers';
import { Decimal } from '../decimal';
import { deserializeState, serializeState } from '../save';
import { chooseLabReward, startLabRun, unlockLab } from './actions';
import { bestRunRecord, readLabBuild, snapshotLabBuild } from './build';
import { breakRun } from './phase';
import { advanceLab } from './run';
import type { LabItem } from './types';

function started(): TestGame {
  const g = newCleanGame();
  hire(g.state, 'pablo', 'angelo');
  g.state.diplomas = 150;
  g.state.diplomasEarned = 150;
  unlockLab(g.state, g.content, T0, g.emit);
  for (const def of g.content.disciplines) g.state.levels[def.id] = 1;
  expect(startLabRun(g.state, g.content, 7, T0, g.emit)).toBe(true);
  return g;
}

const run = (g: TestGame) => g.state.lab.turma.run!;

function item(base: string, rarity: LabItem['rarity'], level: number, uid = 50): LabItem {
  return { uid, base, rarity, level, affixes: [], rerolls: 0 };
}

/** Clears the phase and takes the buff offer, so the next phase begins. */
function nextPhase(g: TestGame): void {
  for (let i = 0; i < 6 && run(g).status === 'fighting'; i += 1) {
    for (const mob of run(g).mobs) mob.hp = 0.001;
    advanceLab(g.state, g.content, 0.2, g.emit);
  }
  run(g).offers = [{ kind: 'commits', amount: 3 }];
  chooseLabReward(g.state, g.content, 0, T0, g.emit);
}

describe('the build a lab record was set with', () => {
  it('starts with the Mouse quebrado at phase 1', () => {
    const g = started();
    expect(g.state.lab.bestPhase).toBe(1);
    expect(g.state.lab.bestPhaseBuild).toEqual([{ slot: 'ferramenta', base: content.lab.starter, rarity: 'comum', level: 1 }]);
  });

  it('is copied when a new highest phase is reached, and stays as it was while the items change', () => {
    const g = started();
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'raro', 3);
    nextPhase(g);
    expect(g.state.lab.bestPhase).toBe(2);
    expect(g.state.lab.bestPhaseBuild.map((entry) => `${entry.slot}:${entry.base}:${entry.rarity}:${entry.level}`)).toEqual([
      `ferramenta:${content.lab.starter}:comum:1`,
      'setup:cadeira-ergonomica:raro:3',
    ]);
    // a later change of items does not rewrite the record while the run is still ahead of it...
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'epico', 9);
    expect(g.state.lab.bestPhaseBuild.find((entry) => entry.slot === 'setup')?.level).toBe(3);
    // ...but the run that ends on its record phase files the build it ended with
    breakRun(g.state, g.content, 'integrity', g.emit);
    expect(g.state.lab.bestPhaseBuild.find((entry) => entry.slot === 'setup')).toMatchObject({ rarity: 'epico', level: 9 });
  });

  it('keeps the old build when a later run does not beat the phase', () => {
    const g = started();
    nextPhase(g);
    nextPhase(g);
    const record = snapshotLabBuild(g.state.lab);
    breakRun(g.state, g.content, 'integrity', g.emit);
    graduate(g.state, g.content, T0, g.emit);
    for (const def of g.content.disciplines) g.state.levels[def.id] = 1;
    startLabRun(g.state, g.content, 8, T0, g.emit);
    expect(g.state.lab.bestPhase).toBe(3);
    expect(g.state.lab.bestPhaseBuild).toEqual(record);
  });

  it('files the build of the best turma at graduation, and only when the turma beats the record', () => {
    const g = started();
    g.state.lab.turma.equipped.amuleto = item('trevo-de-quatro-folhas', 'lendario', 5);
    g.state.runCoins = new Decimal(1e6);
    const first = snapshotLabBuild(g.state.lab);
    // nothing is filed yet, but the live run is ahead of the (empty) record, so it counts with the items equipped now
    expect(g.state.lab.bestRunBuild).toEqual([]);
    expect(bestRunRecord(g.state).coins.eq(1e6)).toBe(true);
    expect(bestRunRecord(g.state).build).toEqual(first);
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.lab.bestRunBuild).toEqual(first);
    expect(g.state.records.mostCoins.eq(1e6)).toBe(true);

    // a smaller turma with other items does not take the record or its build
    for (const def of g.content.disciplines) g.state.levels[def.id] = 1;
    startLabRun(g.state, g.content, 9, T0, g.emit);
    g.state.runCoins = new Decimal(1e5);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'raro', 3);
    graduate(g.state, g.content, T0, g.emit);
    expect(g.state.lab.bestRunBuild).toEqual(first);
    expect(g.state.records.mostCoins.eq(1e6)).toBe(true);
  });

  it('counts the run in progress when it is ahead of the record, with the items equipped now', () => {
    const g = started();
    g.state.records.mostCoins = new Decimal(5e5);
    g.state.lab.bestRunBuild = [{ slot: 'setup', base: 'cadeira-ergonomica', rarity: 'raro', level: 2 }];
    g.state.runCoins = new Decimal(2e5);
    expect(bestRunRecord(g.state).coins.eq(5e5)).toBe(true);
    expect(bestRunRecord(g.state).build).toEqual(g.state.lab.bestRunBuild);
    g.state.runCoins = new Decimal(9e5);
    const live = bestRunRecord(g.state);
    expect(live.coins.eq(9e5)).toBe(true);
    expect(live.build).toEqual(snapshotLabBuild(g.state.lab));
  });

  it('survives a save and load, and a tolerant reader cleans a forged one', () => {
    const g = started();
    nextPhase(g);
    g.state.runCoins = new Decimal(1e6);
    graduate(g.state, g.content, T0, g.emit);
    const back = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(back.lab.bestPhase).toBe(g.state.lab.bestPhase);
    expect(back.lab.bestPhaseBuild).toEqual(g.state.lab.bestPhaseBuild);
    expect(back.lab.bestRunBuild).toEqual(g.state.lab.bestRunBuild);

    const forged = JSON.parse(serializeState(g.state)) as { lab: Record<string, unknown> };
    forged.lab.bestPhaseBuild = 'nope';
    forged.lab.bestRunBuild = [
      { slot: 'setup', base: 'cadeira-ergonomica', rarity: 'lendario', level: 9999 },
      { slot: 'setup', base: 'cadeira-ergonomica', rarity: 'comum', level: 1 },
      { slot: 'ferramenta', base: 'nao-existe', rarity: 'comum', level: 1 },
      { slot: 'amuleto', base: 'trevo-de-quatro-folhas', rarity: 'divino', level: 1 },
      { base: 5 },
      null,
    ];
    const loaded = deserializeState(JSON.stringify(forged), g.content, T0)!;
    expect(loaded.lab.bestPhaseBuild).toEqual([]);
    expect(loaded.lab.bestRunBuild).toEqual([
      { slot: 'setup', base: 'cadeira-ergonomica', rarity: 'lendario', level: g.content.lab.items.maxLevel },
    ]);
  });

  it('puts every item in the slot of its own base, whatever slot the entry claims', () => {
    const build = readLabBuild([{ slot: 'amuleto', base: 'cadeira-ergonomica', rarity: 'raro', level: 2 }], content);
    expect(build).toEqual([{ slot: 'setup', base: 'cadeira-ergonomica', rarity: 'raro', level: 2 }]);
  });

  it('reads an old save (no builds) as empty ones', () => {
    const g = started();
    const old = JSON.parse(serializeState(g.state)) as { lab: Record<string, unknown> };
    delete old.lab.bestPhaseBuild;
    delete old.lab.bestRunBuild;
    const loaded = deserializeState(JSON.stringify(old), g.content, T0)!;
    expect(loaded.lab.bestPhaseBuild).toEqual([]);
    expect(loaded.lab.bestRunBuild).toEqual([]);
  });
});
