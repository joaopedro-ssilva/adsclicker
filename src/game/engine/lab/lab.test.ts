import { describe, expect, it } from 'vitest';
import { content as realContent } from '../../content';
import { LAB_RARITIES, LAB_SLOTS } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import { buyPrestigeNode, graduate } from '../actions';
import { hire, newCleanGame, T0 } from '../__fixtures__/helpers';
import type { TestGame } from '../__fixtures__/helpers';
import { Decimal } from '../decimal';
import { deserializeState, serializeState } from '../save';
import { computeStats } from '../stats';
import { advance } from '../tick';
import {
  buyLabNode,
  chooseLabReward,
  equipLabPending,
  labClick,
  levelUpLabItem,
  recycleLabPending,
  rerollLabAffix,
  setLabOpen,
  startLabRun,
  unlockLab,
} from './actions';
import { labRunAvailable } from './access';
import { levelUpCost, rerollCost } from './costs';
import { labTotals } from './effects';
import { itemPower, rarityChances, rollItem } from './items';
import { breakRun, spawnPhase } from './phase';
import { advanceLab, autoDps, clickDamage, clickShareCap } from './run';
import { labIndex } from './state';
import type { LabItem } from './types';
import { labBenchView, labMonitorView, labRewardsView, labSlotView, labTreeView } from './views';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A game where Pablo is hired and 150 diplomas wait. */
function labGame(mutate?: (content: GameContent) => void): TestGame {
  const g = newCleanGame(mutate);
  hire(g.state, 'pablo');
  g.state.diplomas = 150;
  g.state.diplomasEarned = 150;
  return g;
}

function allAulas(g: TestGame, level = 1): void {
  for (const def of g.content.disciplines) g.state.levels[def.id] = level;
}

/** Lab unlocked, every aula at level 1, run started with the given seed. */
function started(seed = 12345, mutate?: (g: TestGame) => void): TestGame {
  const g = labGame();
  unlockLab(g.state, g.content, T0, g.emit);
  allAulas(g);
  mutate?.(g);
  expect(startLabRun(g.state, g.content, seed, T0, g.emit)).toBe(true);
  return g;
}

function run(g: TestGame) {
  const current = g.state.lab.turma.run;
  if (!current) throw new Error('no run');
  return current;
}

/** Knocks the mobs down to a sliver and lets a step settle (again, if a split leaves new ones): the phase is cleared. */
function clearPhase(g: TestGame): void {
  for (let i = 0; i < 6 && run(g).status === 'fighting'; i += 1) {
    for (const mob of run(g).mobs) mob.hp = 0.001;
    advanceLab(g.state, g.content, 0.2, g.emit);
  }
}

/** A hand-made item. */
function item(base: string, rarity: LabItem['rarity'], level: number, affixes: LabItem['affixes'], uid = 50): LabItem {
  return { uid, base, rarity, level, affixes, rerolls: 0 };
}

function types(g: TestGame): string[] {
  return g.events.map((event) => event.type);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

describe('lab content', () => {
  const lab = realContent.lab;

  it('has the 24 hackathon bases plus the Mouse quebrado, which cannot drop and rolls nothing', () => {
    expect(lab.bases.filter((base) => base.drops)).toHaveLength(24);
    const mouse = lab.bases.find((base) => base.id === lab.starter);
    expect(mouse).toMatchObject({ slot: 'ferramenta', drops: false, affixes: false });
    const rolled = rollItem(realContent, mouse!, 'comum', 1, () => 0.5);
    expect(rolled.affixes).toEqual([]);
    expect(itemPower(realContent, rolled)).toBe(5);
  });

  it('turns every affix target of every base, set and run buff into something', () => {
    const targets = new Set<string>();
    for (const base of lab.bases) {
      if (!base.affixes) continue;
      targets.add(base.primary.target);
      for (const def of base.pool) targets.add(def.target);
      if (base.unique.kind === 'modifiers') base.unique.modifiers.forEach((m) => targets.add(m.target));
      if (base.unique.kind === 'skill') expect(lab.skillBonuses[base.unique.skill]).toBeDefined();
    }
    for (const set of lab.sets) for (const bonus of set.bonuses) bonus.modifiers.forEach((m) => targets.add(m.target));
    for (const buff of lab.buffs) buff.modifiers.forEach((m) => targets.add(m.target));
    for (const target of targets) {
      const entry = lab.affixes[target as keyof typeof lab.affixes];
      expect(entry, target).toBeDefined();
      expect(entry!.add.clicker.length + Object.keys(entry!.add.lab).length, target).toBeGreaterThan(0);
    }
  });

  it('keeps the clicker mapping modest: a max-roll legendary of level 10 is worth about +15% to +60% on its stat', () => {
    const level10 = 1 + lab.items.valuePerLevel * 9;
    for (const base of lab.bases.filter((entry) => entry.drops)) {
      const rarity = lab.rarities.find((entry) => entry.id === 'lendario')!;
      const value = base.primary.max * rarity.valueMultiplier * level10;
      const conversion = lab.affixes[base.primary.target]![base.primary.op];
      for (const part of conversion.clicker) {
        const total = Math.abs(part.per * value);
        if (part.stat === 'comboMax') continue;
        expect(total, `${base.id} ${part.stat}`).toBeGreaterThan(0.1);
        expect(total, `${base.id} ${part.stat}`).toBeLessThan(0.6);
        expect(total).toBeLessThanOrEqual(lab.caps[part.stat] ?? Infinity);
      }
    }
  });

  it('has a tree of three branches whose parents exist and whose positions do not collide', () => {
    const ids = new Set(lab.tree.map((node) => node.id));
    expect(ids.size).toBe(lab.tree.length);
    expect(new Set(lab.tree.map((node) => node.branch))).toEqual(new Set(['codigo', 'infra', 'produto']));
    expect(lab.tree.length).toBeGreaterThanOrEqual(9);
    expect(lab.tree.length).toBeLessThanOrEqual(12);
    const spots = new Set<string>();
    for (const node of lab.tree) {
      for (const parent of node.requires) expect(ids.has(parent), `${node.id} <- ${parent}`).toBe(true);
      const spot = `${node.position.col},${node.position.row}`;
      expect(spots.has(spot), spot).toBe(false);
      spots.add(spot);
      expect(node.cost).toBeGreaterThan(0);
    }
  });

  it('has a boss, a split enemy and an unlock phase for every regular enemy', () => {
    const index = labIndex(realContent);
    expect(index.enemies.get(lab.run.bossEnemy)?.boss).toBe(true);
    for (const id of Object.keys(lab.run.enemyFrom)) expect(index.enemies.get(id)?.boss).toBe(false);
    for (const enemy of lab.enemies) {
      for (const trait of enemy.traits) if (trait.kind === 'split') expect(index.enemies.has(trait.into)).toBe(true);
    }
  });

  it('has rarities in the same order as the Hackathon', () => {
    expect(lab.rarities.map((rarity) => rarity.id)).toEqual([...LAB_RARITIES]);
    const chances = rarityChances(realContent, 0);
    expect(chances.reduce((sum, entry) => sum + entry.chance, 0)).toBeCloseTo(1, 9);
    // more quality never lowers the chance of a rarity or better
    const better = rarityChances(realContent, 80);
    let a = 0;
    let b = 0;
    for (let i = LAB_RARITIES.length - 1; i >= 0; i -= 1) {
      a += chances[i]!.chance;
      b += better[i]!.chance;
      expect(b + 1e-12).toBeGreaterThanOrEqual(a);
    }
  });
});

// ---------------------------------------------------------------------------
// Unlock and the gate
// ---------------------------------------------------------------------------

describe('unlock', () => {
  it('shows the slot once Pablo is hired and costs 100 diplomas, once', () => {
    const g = newCleanGame();
    expect(labSlotView(g.state, g.content).visible).toBe(false);
    g.state.diplomas = 500;
    expect(unlockLab(g.state, g.content, T0, g.emit)).toBe(false); // Pablo is not hired
    hire(g.state, 'pablo');
    expect(labSlotView(g.state, g.content)).toMatchObject({ visible: true, unlocked: false, canUnlock: true, cost: 100 });

    g.state.diplomas = 99;
    expect(unlockLab(g.state, g.content, T0, g.emit)).toBe(false);
    expect(g.state.lab.unlocked).toBe(false);

    g.state.diplomas = 130;
    g.state.diplomasEarned = 130;
    expect(unlockLab(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.diplomas).toBe(30);
    expect(g.state.diplomasEarned).toBe(130); // the production bonus is not touched
    expect(g.state.lab.unlocked).toBe(true);
    expect(types(g)).toContain('labUnlocked');

    g.state.diplomas = 500;
    expect(unlockLab(g.state, g.content, T0, g.emit)).toBe(false); // never charged twice
    expect(g.state.diplomas).toBe(500);
  });

  it('survives a graduation and a save', () => {
    const g = labGame();
    hire(g.state, 'angelo');
    unlockLab(g.state, g.content, T0, g.emit);
    g.state.runCoins = new Decimal(1e6);
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.lab.unlocked).toBe(true);
    const loaded = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(loaded.lab.unlocked).toBe(true);
    expect(loaded.diplomas).toBe(g.state.diplomas);
  });
});

describe('the per-turma gate', () => {
  it('needs every aula at level 1, with a reason that counts the missing ones', () => {
    const g = labGame();
    unlockLab(g.state, g.content, T0, g.emit);
    const total = g.content.disciplines.length;
    expect(labRunAvailable(g.state, g.content)).toEqual({ ok: false, missing: total, reason: `Faltam ${total} aulas` });

    allAulas(g);
    const last = g.content.disciplines[total - 1]!;
    delete g.state.levels[last.id];
    expect(labRunAvailable(g.state, g.content)).toEqual({ ok: false, missing: 1, reason: 'Falta 1 aula' });
    expect(startLabRun(g.state, g.content, 1, T0, g.emit)).toBe(false);
    expect(g.state.lab.turma.run).toBeNull();

    g.state.levels[last.id] = 1;
    expect(labRunAvailable(g.state, g.content)).toEqual({ ok: true, missing: 0, reason: null });
    expect(startLabRun(g.state, g.content, 1, T0, g.emit)).toBe(true);
  });

  it('does not start before the lab is unlocked, nor twice in one turma', () => {
    const g = labGame();
    allAulas(g);
    expect(labRunAvailable(g.state, g.content).ok).toBe(false);
    expect(startLabRun(g.state, g.content, 1, T0, g.emit)).toBe(false);
    unlockLab(g.state, g.content, T0, g.emit);
    expect(startLabRun(g.state, g.content, 1, T0, g.emit)).toBe(true);
    expect(startLabRun(g.state, g.content, 2, T0, g.emit)).toBe(false);
    run(g).status = 'broken';
    expect(startLabRun(g.state, g.content, 2, T0, g.emit)).toBe(false); // a broken monitor ends the lab for the turma
  });

  it('starts a run with only the Mouse quebrado, a full monitor and the first wave', () => {
    const g = started(77);
    const { equipped, run: current } = g.state.lab.turma;
    expect(Object.keys(equipped)).toEqual(['ferramenta']);
    expect(equipped.ferramenta).toMatchObject({ base: 'mouse-quebrado', rarity: 'comum', level: 1, affixes: [] });
    expect(current).toMatchObject({ seed: 77, status: 'fighting', phase: 1, integrity: 100, maxIntegrity: 100 });
    expect(current!.mobs.length).toBeGreaterThanOrEqual(2);
    expect(g.state.lab.open).toBe(true);
    expect(g.state.lab.counters.runs).toBe(1);
    expect(g.state.lab.bestPhase).toBe(1);
    expect(types(g)).toContain('labRunStarted');
  });
});

// ---------------------------------------------------------------------------
// The fight
// ---------------------------------------------------------------------------

describe('damage', () => {
  it('is the power of the equipped items times the bonuses', () => {
    const g = started();
    expect(autoDps(labTotals(g.state, g.content), false)).toBe(5);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'comum', 1, [{ target: 'foco', op: 'add', value: 20 }]);
    g.state.lab.tree['algoritmos-eficientes'] = 3;
    g.state.lab.turma.run!.buffs['stack-overflow'] = 1;
    const totals = labTotals(g.state, g.content);
    expect(totals.power).toBeCloseTo(10);
    expect(autoDps(totals, false)).toBeCloseTo(10 * (1 + 0.3 + 0.3));
  });

  it('wears the mobs down front to back, a mob per kill', () => {
    const g = started(3);
    const before = run(g).mobs.length;
    const first = run(g).mobs[0]!;
    advanceLab(g.state, g.content, 1, g.emit);
    expect(run(g).t).toBeCloseTo(1, 6);
    expect(run(g).mobs[0]!.hp).toBeLessThan(first.maxHp);
    expect(run(g).mobs.length).toBeLessThanOrEqual(before);
  });

  it('is cut into fixed steps, so the tick rate does not matter', () => {
    const a = started(9);
    const b = started(9);
    for (let i = 0; i < 20; i += 1) advanceLab(a.state, a.content, 0.1, a.emit);
    advanceLab(b.state, b.content, 2, b.emit);
    expect(JSON.stringify(run(a))).toBe(JSON.stringify(run(b)));
  });
});

describe('clicks', () => {
  function dummy(g: TestGame): void {
    const mob = run(g).mobs[0]!;
    mob.hp = 1e6;
    mob.maxHp = 1e6;
    run(g).mobs = [mob];
  }

  it('deal 4% of the automatic damage each', () => {
    const g = started();
    dummy(g);
    const before = run(g).mobs[0]!.hp;
    expect(labClick(g.state, g.content, T0, g.emit)).toBe(true);
    expect(before - run(g).mobs[0]!.hp).toBeCloseTo(5 * 0.04, 9);
    expect(clickDamage(g.content, labTotals(g.state, g.content), false)).toBeCloseTo(0.2);
  });

  it('count at most 5 per rolling second: an autoclicker adds at most 20% of the automatic damage', () => {
    expect(clickShareCap(realContent)).toBeCloseTo(0.2, 9);
    const g = started();
    dummy(g);
    const before = run(g).mobs[0]!.hp;
    let counted = 0;
    for (let i = 0; i < 1000; i += 1) if (labClick(g.state, g.content, T0 + i * 5, g.emit)) counted += 1; // 200 clicks/s for 5 s
    expect(counted).toBe(25);
    expect(before - run(g).mobs[0]!.hp).toBeCloseTo(25 * 0.2, 6);
    // and never more than 20% of 5 s of automatic damage
    expect(before - run(g).mobs[0]!.hp).toBeLessThanOrEqual(0.2 * 5 * 5 + 1e-9);
  });

  it('count again once the window moves on, and only while the lab is open', () => {
    const g = started();
    dummy(g);
    for (let i = 0; i < 5; i += 1) expect(labClick(g.state, g.content, T0 + i, g.emit)).toBe(true);
    expect(labClick(g.state, g.content, T0 + 500, g.emit)).toBe(false);
    expect(labClick(g.state, g.content, T0 + 1001, g.emit)).toBe(true);
    setLabOpen(g.state, false);
    expect(labClick(g.state, g.content, T0 + 9000, g.emit)).toBe(false);
  });

  it('can clear the phase', () => {
    const g = started();
    for (const mob of run(g).mobs) mob.hp = 0.0001;
    for (let i = 0; i < 10; i += 1) labClick(g.state, g.content, T0 + i * 250, g.emit);
    expect(run(g).status).toBe('reward');
  });
});

describe('the run is paused while the lab is closed', () => {
  it('advances only when open, and by at most a couple of seconds per tick (no offline progress)', () => {
    const g = started();
    setLabOpen(g.state, false);
    advanceLab(g.state, g.content, 5, g.emit);
    expect(run(g).t).toBe(0);

    setLabOpen(g.state, true);
    g.state.lastTickAt = T0;
    advance(g.state, g.content, T0 + 3_600_000, g.rng, g.emit); // an hour passes in one tick
    expect(run(g).t).toBeLessThanOrEqual(g.content.lab.run.maxAdvanceSeconds + 1e-9);
    expect(run(g).t).toBeGreaterThan(0);
  });

  it('is driven by the main tick', () => {
    const g = started();
    advance(g.state, g.content, T0 + 1000, g.rng, g.emit);
    expect(run(g).t).toBeCloseTo(1, 6);
  });
});

describe('breaking the monitor', () => {
  it('breaks when a boss timer of 30 s runs out', () => {
    const g = started();
    run(g).phase = 5;
    spawnPhase(g.state, g.content, labTotals(g.state, g.content));
    expect(run(g).bossLeft).toBe(30);
    expect(labMonitorView(g.state, g.content)).toMatchObject({ boss: true, bossTotal: 30 });
    run(g).mobs[0]!.hp = 1e12;
    for (let i = 0; i < 14; i += 1) advanceLab(g.state, g.content, 2, g.emit);
    expect(run(g).status).toBe('fighting');
    expect(run(g).bossLeft).toBeCloseTo(2, 3);
    advanceLab(g.state, g.content, 2, g.emit);
    expect(run(g)).toMatchObject({ status: 'broken', brokenBy: 'timer' });
    expect(types(g)).toContain('labBroken');
  });

  it('breaks when the integrity hits 0', () => {
    const g = started();
    for (const mob of run(g).mobs) mob.hp = mob.maxHp = 1e12;
    run(g).integrity = 0.4;
    for (let i = 0; i < 5 && run(g).status === 'fighting'; i += 1) advanceLab(g.state, g.content, 1, g.emit);
    expect(run(g)).toMatchObject({ status: 'broken', brokenBy: 'integrity' });
    // a broken monitor stays broken and nothing moves
    const snapshot = JSON.stringify(run(g));
    advanceLab(g.state, g.content, 5, g.emit);
    expect(JSON.stringify(run(g))).toBe(snapshot);
  });

  it('is saved from a lethal drain by a second wind, once per phase per charge', () => {
    const g = started();
    g.state.lab.tree['nobreak-do-lab'] = 1;
    for (const mob of run(g).mobs) mob.hp = mob.maxHp = 1e12;
    run(g).integrity = 0.1;
    for (let i = 0; i < 3; i += 1) advanceLab(g.state, g.content, 1, g.emit);
    expect(run(g).status).toBe('fighting');
    expect(run(g).windUsed).toBe(1);
    expect(run(g).integrity).toBeGreaterThan(5);
  });

  it('pays Commits for the phases cleared and the bosses beaten', () => {
    const g = started();
    run(g).cleared = 7;
    run(g).bosses = 1;
    breakRun(g.state, g.content, 'integrity', g.emit);
    expect(g.state.lab.commits).toBe(7 * 3 + 25);
    expect(run(g).paid).toBe(46);
    expect(g.state.lab.counters.broken).toBe(1);
    breakRun(g.state, g.content, 'timer', g.emit); // no double payment
    expect(g.state.lab.commits).toBe(46);
  });

  it('records the phase reached', () => {
    const g = started();
    run(g).phase = 12;
    run(g).cleared = 11;
    breakRun(g.state, g.content, 'integrity', g.emit);
    expect(g.state.lab.bestPhase).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Phases, bosses and rewards
// ---------------------------------------------------------------------------

describe('phases', () => {
  it('grow the HP by 18% and the drain by 12% per phase, and every 5th phase is a boss', () => {
    const g = started(5);
    const hpAt = (phase: number) => {
      run(g).phase = phase;
      spawnPhase(g.state, g.content, labTotals(g.state, g.content));
      return run(g).mobs.map((mob) => mob.maxHp);
    };
    const first = hpAt(1);
    const later = hpAt(11);
    // both waves draw their kinds from the stream, so compare through the factor
    const factor = labIndex(g.content).enemies.get('bug')!.hp * g.content.lab.run.hpScale;
    expect(first.every((hp) => hp >= factor * 0.5 - 1e-9)).toBe(true);
    expect(g.content.lab.run.hpGrowth ** 10).toBeCloseTo(5.234, 2);
    expect(g.content.lab.run.drainGrowth).toBe(1.12);
    expect(later.length).toBeGreaterThanOrEqual(2);
    for (const phase of [5, 10, 15]) {
      hpAt(phase);
      expect(run(g).mobs).toHaveLength(1);
      expect(run(g).mobs[0]!.def).toBe('deploy-de-sexta');
      expect(run(g).bossLeft).toBe(30);
    }
    hpAt(6);
    expect(run(g).bossLeft).toBeNull();
    expect(run(g).mobs.length).toBeGreaterThanOrEqual(2);
    expect(run(g).mobs.length).toBeLessThanOrEqual(6);
  });

  it('are the same for the same seed', () => {
    const a = started(2024);
    const b = started(2024);
    for (const phase of [1, 2, 3, 7]) {
      run(a).phase = phase;
      run(b).phase = phase;
      spawnPhase(a.state, a.content, labTotals(a.state, a.content));
      spawnPhase(b.state, b.content, labTotals(b.state, b.content));
      expect(run(a).mobs).toEqual(run(b).mobs);
    }
  });

  it('split a Conflito de merge into two Bugs de merge when it dies', () => {
    const g = started();
    const merge = labIndex(g.content).enemies.get('conflito-de-merge')!;
    run(g).mobs = [{ uid: 99, def: merge.id, hp: 0.001, maxHp: merge.hp }];
    run(g).mobSeq = 99;
    advanceLab(g.state, g.content, 0.1, g.emit);
    expect(run(g).status).toBe('fighting');
    expect(run(g).mobs.map((mob) => mob.def)).toEqual(['bug-de-merge', 'bug-de-merge']);
  });
});

describe('rewards', () => {
  it('open with three options after a phase, the first one an item', () => {
    const g = started(31);
    clearPhase(g);
    expect(run(g).status).toBe('reward');
    expect(run(g).offers).toHaveLength(3);
    expect(run(g).offers[0]!.kind).toBe('item');
    expect(run(g).cleared).toBe(1);
    expect(run(g).clearLog).toHaveLength(1);
    expect(types(g)).toContain('labPhaseCleared');
    expect(labRewardsView(g.state, g.content)).toMatchObject({ open: true, phase: 1 });
    expect(labRewardsView(g.state, g.content).options).toHaveLength(3);
    // nothing moves while the player chooses
    const t = run(g).t;
    advanceLab(g.state, g.content, 5, g.emit);
    expect(run(g).t).toBe(t);
  });

  it('are decided by the seed and the phase, not by what the player does in between', () => {
    const a = started(555);
    const b = started(555);
    const c = started(556);
    clearPhase(a);
    for (let i = 0; i < 5; i += 1) labClick(b.state, b.content, T0 + i, b.emit); // different play, same seed
    clearPhase(b);
    clearPhase(c);
    expect(run(a).offers).toEqual(run(b).offers);
    expect(JSON.stringify(run(a).offers)).not.toBe(JSON.stringify(run(c).offers));
  });

  it('replay: the same seed and the same choices give the same run', () => {
    const play = () => {
      const g = started(808);
      for (let n = 0; n < 4; n += 1) {
        clearPhase(g);
        chooseLabReward(g.state, g.content, 0, T0, g.emit);
        if (run(g).status === 'equip') recycleLabPending(g.state, g.content, T0, g.emit);
      }
      return JSON.stringify(g.state.lab);
    };
    expect(play()).toBe(play());
  });

  it('give a better rarity after a boss: the first item is at least raro, the second at least incomum', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const g = started(seed * 101);
      run(g).phase = 5;
      spawnPhase(g.state, g.content, labTotals(g.state, g.content));
      clearPhase(g);
      const items = run(g).offers.flatMap((offer) => (offer.kind === 'item' ? [offer.item] : []));
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(['raro', 'epico', 'lendario']).toContain(items[0]!.rarity);
      expect(items[1]!.rarity).not.toBe('comum');
      expect(items[0]!.level).toBeGreaterThanOrEqual(2); // 1 + floor(4/3) + 1 for the boss
    }
  });

  it('make better items with luck and with depth, and the item level grows with the phase', () => {
    const lowLuck = rarityChances(realContent, 0);
    const highLuck = rarityChances(realContent, 100);
    expect(highLuck[4]!.chance).toBeGreaterThan(lowLuck[4]!.chance * 2);
    const g = started(4);
    run(g).phase = 16;
    spawnPhase(g.state, g.content, labTotals(g.state, g.content));
    clearPhase(g);
    const levels = run(g).offers.flatMap((offer) => (offer.kind === 'item' ? [offer.item.level] : []));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(1 + Math.floor(15 / 3));
  });

  it('put a new item in an empty slot at once', () => {
    const g = started(31);
    clearPhase(g);
    const offer = run(g).offers[0]!;
    if (offer.kind !== 'item') throw new Error('expected an item');
    const slot = labIndex(g.content).bases.get(offer.item.base)!.slot;
    g.state.lab.turma.equipped = {}; // make sure the slot is free
    expect(chooseLabReward(g.state, g.content, 0, T0, g.emit)).toBe(true);
    expect(g.state.lab.turma.equipped[slot]).toMatchObject({ base: offer.item.base, rarity: offer.item.rarity });
    expect(g.state.lab.turma.equipped[slot]!.uid).toBeGreaterThan(0);
    expect(run(g)).toMatchObject({ status: 'fighting', phase: 2 });
  });

  it('wait for a decision when the slot is taken: equip recycles the old item, recycle keeps it', () => {
    const make = () => {
      const g = started(31);
      clearPhase(g);
      const offer = run(g).offers[0]!;
      if (offer.kind !== 'item') throw new Error('expected an item');
      const slot = labIndex(g.content).bases.get(offer.item.base)!.slot;
      const old = item('mesa-regulavel', 'raro', 3, [{ target: 'resiliencia', op: 'add', value: 5 }], 30);
      g.state.lab.turma.equipped = { [slot]: { ...old, base: slot === 'ferramenta' ? 'calculadora-cientifica' : old.base } as LabItem };
      return { g, slot, offer };
    };

    const a = make();
    expect(chooseLabReward(a.g.state, a.g.content, 0, T0, a.g.emit)).toBe(true);
    expect(run(a.g).status).toBe('equip');
    expect(run(a.g).pending).toMatchObject({ base: a.offer.item.base });
    expect(labBenchView(a.g.state, a.g.content).pending?.replaces).not.toBeNull();
    const oldItem = a.g.state.lab.turma.equipped[a.slot]!;
    const oldValue = Math.floor(labIndex(a.g.content).rarities.get('raro')!.recycleCommits * (1 + 0.1 * 2));
    expect(equipLabPending(a.g.state, a.g.content, T0, a.g.emit)).toBe(true);
    expect(a.g.state.lab.turma.equipped[a.slot]!.base).toBe(a.offer.item.base);
    expect(a.g.state.lab.commits).toBe(oldValue);
    expect(oldItem.uid).toBe(30);
    expect(run(a.g)).toMatchObject({ status: 'fighting', phase: 2, pending: null });

    const b = make();
    chooseLabReward(b.g.state, b.g.content, 0, T0, b.g.emit);
    const kept = b.g.state.lab.turma.equipped[b.slot]!;
    expect(recycleLabPending(b.g.state, b.g.content, T0, b.g.emit)).toBe(true);
    expect(b.g.state.lab.turma.equipped[b.slot]).toEqual(kept);
    expect(b.g.state.lab.commits).toBe(labIndex(b.g.content).rarities.get(b.offer.item.rarity)!.recycleCommits); // level 1
    expect(b.g.state.lab.counters.itemsRecycled).toBe(1);
  });

  it('can be a run buff (kept to graduation), Commits, or a repair', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 40 && kinds.size < 4; seed += 1) {
      const g = started(seed * 13);
      run(g).integrity = 20;
      clearPhase(g);
      run(g).offers.forEach((offer) => kinds.add(offer.kind));
    }
    expect([...kinds].sort()).toEqual(['buff', 'commits', 'item', 'repair']);

    const g = started(1);
    clearPhase(g);
    run(g).offers = [{ kind: 'buff', buff: 'stack-overflow' }, { kind: 'commits', amount: 12 }, { kind: 'repair', share: 0.25 }];
    chooseLabReward(g.state, g.content, 0, T0, g.emit);
    expect(run(g).buffs).toEqual({ 'stack-overflow': 1 });
    expect(run(g).phase).toBe(2);
    clearPhase(g);
    run(g).offers = [{ kind: 'commits', amount: 12 }];
    chooseLabReward(g.state, g.content, 0, T0, g.emit);
    expect(g.state.lab.commits).toBe(12);
    run(g).integrity = 40;
    clearPhase(g);
    run(g).integrity = 40;
    run(g).offers = [{ kind: 'repair', share: 0.25 }];
    chooseLabReward(g.state, g.content, 0, T0, g.emit);
    expect(run(g).integrity).toBe(65);
  });

  it('ignores a choice that is not on screen', () => {
    const g = started();
    expect(chooseLabReward(g.state, g.content, 0, T0, g.emit)).toBe(false); // still fighting
    clearPhase(g);
    expect(chooseLabReward(g.state, g.content, 9, T0, g.emit)).toBe(false);
    expect(run(g).status).toBe('reward');
  });

  it('show 4 options on the first reward with the tree, and a boss reward is made of items', () => {
    const g = started(31, (game) => {
      game.state.lab.tree['revisao-de-pr'] = 1;
    });
    clearPhase(g);
    expect(run(g).offers).toHaveLength(4);
    chooseLabReward(g.state, g.content, 1, T0, g.emit);
    clearPhase(g);
    expect(run(g).offers).toHaveLength(3); // only the first one
  });
});

// ---------------------------------------------------------------------------
// Items and the clicker
// ---------------------------------------------------------------------------

describe('item effects in computeStats', () => {
  it('buff nothing while the lab is locked or the item is the Mouse quebrado', () => {
    const g = newCleanGame();
    const before = computeStats(g.state, g.content);
    g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'comum', 1, [{ target: 'logica', op: 'add', value: 10 }]);
    expect(computeStats(g.state, g.content).clickPower).toBe(before.clickPower); // locked
    g.state.lab.unlocked = true;
    expect(computeStats(g.state, g.content).clickPower).toBeCloseTo(1.2);
    g.state.lab.turma.equipped.ferramenta = item('mouse-quebrado', 'comum', 1, []);
    expect(computeStats(g.state, g.content).clickPower).toBe(before.clickPower);
  });

  it('maps each hackathon stat to its clicker stat, scaled by the item level', () => {
    const g = newCleanGame();
    g.state.lab.unlocked = true;
    const base = computeStats(g.state, g.content);
    const stats = (...affixes: LabItem['affixes']) => {
      g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'raro', 11, affixes); // level 11 -> x2.2
      return computeStats(g.state, g.content);
    };
    expect(stats({ target: 'logica', op: 'add', value: 5 }).clickPower).toBeCloseTo(1 + 5 * 2.2 * 0.02);
    expect(stats({ target: 'logica', op: 'pct', value: 10 }).clickPower).toBeCloseTo(1 + 10 * 2.2 * 0.01);
    const agility = stats({ target: 'agilidade', op: 'add', value: 5 });
    expect(agility.comboMax).toBeGreaterThan(base.comboMax);
    expect(agility.comboDecay).toBeLessThan(base.comboDecay);
    expect(stats({ target: 'foco', op: 'add', value: 20 }).abilityDuration).toBeCloseTo(1 + 20 * 2.2 * 0.003);
    expect(stats({ target: 'resiliencia', op: 'add', value: 5 }).eventWindow).toBeCloseTo(1 + 5 * 2.2 * 0.015);
    expect(stats({ target: 'atencao', op: 'add', value: 3 }).critChance).toBeCloseTo(base.critChance + 3 * 2.2 * 0.01);
    expect(stats({ target: 'cooldown', op: 'add', value: 5 }).abilityCooldown).toBeCloseTo(1 - 5 * 2.2 * 0.008);
    expect(stats({ target: 'bossDamage', op: 'add', value: 5 }).eventReward).toBeCloseTo(1 + 5 * 2.2 * 0.01);
    expect(stats({ target: 'commitsGain', op: 'add', value: 5 }).sprintReward).toBeCloseTo(1 + 5 * 2.2 * 0.01);
    expect(stats({ target: 'skillPower', op: 'add', value: 5 }).activeBonus).toBeCloseTo(base.activeBonus + 5 * 2.2 * 0.005);
    // lab-only affixes do not touch the clicker
    const luck = stats({ target: 'sorte', op: 'add', value: 5 });
    expect(luck.clickPower).toBe(base.clickPower);
    expect(labTotals(g.state, g.content).lab.luck).toBeCloseTo(5 * 2.2);
    // nothing touches raw production
    expect(luck.globalPower).toBe(base.globalPower);
    expect(luck.idlePower).toBe(base.idlePower);
  });

  it('add the legendary unique only to legendary items', () => {
    const g = newCleanGame();
    g.state.lab.unlocked = true;
    const base = computeStats(g.state, g.content).critChance;
    g.state.lab.turma.equipped.ferramenta = item('mouse-vertical', 'epico', 1, [{ target: 'atencao', op: 'add', value: 0 }]);
    expect(computeStats(g.state, g.content).critChance).toBeCloseTo(base);
    g.state.lab.turma.equipped.ferramenta = item('mouse-vertical', 'lendario', 1, [{ target: 'atencao', op: 'add', value: 0 }]);
    expect(computeStats(g.state, g.content).critChance).toBeCloseTo(base + 30 * 0.0015);
    // a skill unique and a modifiers unique
    g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'lendario', 1, [{ target: 'logica', op: 'add', value: 0 }]);
    expect(labTotals(g.state, g.content).lab.damage).toBeCloseTo(0.15);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'lendario', 1, [{ target: 'foco', op: 'add', value: 0 }]);
    expect(computeStats(g.state, g.content).abilityDuration).toBeCloseTo(1 + 20 * 0.01);
    g.state.lab.turma.equipped.amuleto = item('pato-de-borracha', 'lendario', 1, [{ target: 'sorte', op: 'add', value: 0 }]);
    expect(labTotals(g.state, g.content).lab.secondWind).toBe(1);
  });

  it('give the Kit Plantão bonuses at 2 and 4 pieces', () => {
    const g = newCleanGame();
    g.state.lab.unlocked = true;
    const base = computeStats(g.state, g.content);
    const zero = (target: 'logica' | 'foco' | 'resiliencia' | 'cooldown') => [{ target, op: 'add' as const, value: 0 }];
    g.state.lab.turma.equipped.ferramenta = item('editor-escuro', 'comum', 1, [{ target: 'logica', op: 'pct', value: 0 }]);
    expect(computeStats(g.state, g.content).clickPower).toBe(1);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'comum', 1, zero('foco'));
    expect(computeStats(g.state, g.content).clickPower).toBeCloseTo(1 + 8 * 0.01);
    expect(computeStats(g.state, g.content).abilityDuration).toBeCloseTo(1 + 8 * 0.01);
    g.state.lab.turma.equipped.acessorio = item('fone-cancelamento', 'comum', 1, zero('resiliencia'));
    g.state.lab.turma.equipped.amuleto = item('caneca-termica', 'comum', 1, zero('cooldown'));
    const four = computeStats(g.state, g.content);
    expect(four.abilityCooldown).toBeCloseTo(1 - 15 * 0.008);
    expect(four.eventWindow).toBeCloseTo(1 + 10 * 0.015);
    expect(four.activeBonus).toBeCloseTo(base.activeBonus + 25 * 0.005);
  });

  it('count run buffs too, scaled by the stacks, and the tree adds 10% per level to all of it', () => {
    const g = started();
    run(g).buffs['stack-overflow'] = 2;
    expect(computeStats(g.state, g.content).clickPower).toBeCloseTo(1 + 2 * 30 * 0.01);
    g.state.lab.tree['documentacao'] = 3;
    expect(computeStats(g.state, g.content).clickPower).toBeCloseTo(1 + 2 * 30 * 0.01 * 1.3);
  });

  it('are capped, whatever the items and buffs add up to', () => {
    const g = started();
    run(g).buffs['stack-overflow'] = 90;
    g.state.lab.turma.equipped.setup = item('mesa-regulavel', 'lendario', 20, [{ target: 'logica', op: 'add', value: 1000 }]);
    const stats = computeStats(g.state, g.content);
    expect(stats.clickPower).toBe(1 + g.content.lab.caps.clickPower!);
    g.state.lab.turma.equipped.ferramenta = item('relogio-de-ponto', 'lendario', 20, [{ target: 'cooldown', op: 'add', value: 1000 }]);
    expect(computeStats(g.state, g.content).abilityCooldown).toBeCloseTo(1 - g.content.lab.caps.abilityCooldown!);
  });
});

// ---------------------------------------------------------------------------
// ADScoins
// ---------------------------------------------------------------------------

describe('ADScoins: level up and reroll', () => {
  it('cost 1e24 for a comum item of level 1, x10 per rarity and x6 per level', () => {
    const c = realContent;
    const make = (rarity: LabItem['rarity'], level: number, rerolls = 0): LabItem => ({ ...item('notebook-velho', rarity, level, []), rerolls });
    expect(levelUpCost(c, make('comum', 1))!.toNumber()).toBeCloseTo(1e24, -10);
    expect(levelUpCost(c, make('incomum', 1))!.div(1e25).toNumber()).toBeCloseTo(1, 9);
    expect(levelUpCost(c, make('lendario', 1))!.div(1e28).toNumber()).toBeCloseTo(1, 9);
    expect(levelUpCost(c, make('comum', 2))!.div(6e24).toNumber()).toBeCloseTo(1, 9);
    expect(levelUpCost(c, make('comum', 5))!.div(Decimal.pow(6, 4).mul(1e24)).toNumber()).toBeCloseTo(1, 9);
    expect(levelUpCost(c, make('comum', c.lab.items.maxLevel))).toBeNull();
    for (const rarity of LAB_RARITIES) {
      expect(rerollCost(c, make(rarity, 1)).lt(levelUpCost(c, make(rarity, 1))!)).toBe(true);
      expect(rerollCost(c, make(rarity, 8)).lt(levelUpCost(c, make(rarity, 8))!)).toBe(true);
    }
    expect(rerollCost(c, make('comum', 1)).div(2e23).toNumber()).toBeCloseTo(1, 9);
    expect(rerollCost(c, make('comum', 1, 3)).div(rerollCost(c, make('comum', 1))).toNumber()).toBeCloseTo(8, 9);
  });

  it('level up spends the coins and raises the power and the buff', () => {
    const g = started();
    const mouse = () => g.state.lab.turma.equipped.ferramenta!;
    g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'comum', 1, [{ target: 'logica', op: 'add', value: 3 }], 1);
    g.state.coins = new Decimal('9e23');
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(false);
    expect(g.state.coins.toNumber()).toBeCloseTo(9e23, -10);
    expect(mouse().level).toBe(1);

    g.state.coins = new Decimal('2.5e24');
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(true);
    expect(mouse().level).toBe(2);
    expect(g.state.coins.toNumber() / 1.5e24).toBeCloseTo(1, 6);
    expect(itemPower(g.content, mouse())).toBeCloseTo(5 * 1.15);
    expect(computeStats(g.state, g.content).clickPower).toBeCloseTo(1 + 3 * 1.12 * 0.02);
    expect(levelUpLabItem(g.state, g.content, 'setup', T0, g.emit)).toBe(false); // empty slot
    expect(g.state.lab.counters.itemLevelUps).toBe(1);
  });

  it('level up works with the lab closed and between fights', () => {
    const g = started();
    setLabOpen(g.state, false);
    g.state.coins = new Decimal('1e30');
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(true);
    setLabOpen(g.state, true);
    clearPhase(g);
    expect(run(g).status).toBe('reward');
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(true);
  });

  it('stops at the top level', () => {
    const g = started();
    g.state.coins = new Decimal('1e300');
    g.state.lab.turma.equipped.ferramenta!.level = g.content.lab.items.maxLevel;
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(false);
  });

  it('reroll changes one affix, from the seed, and each reroll of the item costs double', () => {
    const make = () => {
      const g = started(99);
      const rolled = rollItem(g.content, labIndex(g.content).bases.get('notebook-velho')!, 'epico', 3, () => 0.5);
      rolled.uid = 7;
      g.state.lab.turma.equipped.ferramenta = rolled;
      g.state.coins = new Decimal('1e40');
      return g;
    };
    const a = make();
    const before = JSON.stringify(a.state.lab.turma.equipped.ferramenta!.affixes);
    const cost0 = rerollCost(a.content, a.state.lab.turma.equipped.ferramenta!);
    expect(rerollLabAffix(a.state, a.content, 'ferramenta', 1, T0, a.emit)).toBe(true);
    const rerolled = a.state.lab.turma.equipped.ferramenta!;
    expect(rerolled.rerolls).toBe(1);
    expect(rerolled.affixes[0]).toEqual(JSON.parse(before)[0]); // the others stay
    expect(rerolled.affixes).toHaveLength(3);
    expect(rerollCost(a.content, rerolled).div(cost0).toNumber()).toBeCloseTo(2, 9);
    expect(new Decimal('1e40').sub(a.state.coins).div(cost0).toNumber()).toBeCloseTo(1, 6);

    const b = make();
    rerollLabAffix(b.state, b.content, 'ferramenta', 1, T0, b.emit);
    expect(b.state.lab.turma.equipped.ferramenta).toEqual(rerolled); // same seed, same item, same reroll

    // the primary keeps its target and draws a new value
    const c = make();
    const target = c.state.lab.turma.equipped.ferramenta!.affixes[0]!.target;
    expect(rerollLabAffix(c.state, c.content, 'ferramenta', 0, T0, c.emit)).toBe(true);
    expect(c.state.lab.turma.equipped.ferramenta!.affixes[0]!.target).toBe(target);
    // no affix there, no coins spent
    const coins = c.state.coins;
    expect(rerollLabAffix(c.state, c.content, 'ferramenta', 9, T0, c.emit)).toBe(false);
    expect(c.state.coins.eq(coins)).toBe(true);
  });

  it('needs the coins, and a comum item can have its primary rerolled but the mouse cannot', () => {
    const g = started();
    g.state.coins = new Decimal('1e40');
    expect(rerollLabAffix(g.state, g.content, 'ferramenta', 0, T0, g.emit)).toBe(false); // the mouse rolls nothing
    g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'comum', 1, [{ target: 'logica', op: 'add', value: 3 }], 4);
    g.state.coins = new Decimal('1e23');
    expect(rerollLabAffix(g.state, g.content, 'ferramenta', 0, T0, g.emit)).toBe(false);
    g.state.coins = new Decimal('1e24');
    expect(rerollLabAffix(g.state, g.content, 'ferramenta', 0, T0, g.emit)).toBe(true);
  });

  it('works only once the lab is unlocked', () => {
    const g = newCleanGame();
    g.state.lab.turma.equipped.ferramenta = item('notebook-velho', 'comum', 1, []);
    g.state.coins = new Decimal('1e40');
    expect(levelUpLabItem(g.state, g.content, 'ferramenta', T0, g.emit)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Commits and the tree
// ---------------------------------------------------------------------------

describe('Commits and the tree', () => {
  it('recycling pays by rarity (5 / 12 / 30 / 80 / 250), a little more for each level', () => {
    const view = (rarity: LabItem['rarity'], level: number) => {
      const g = started();
      g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', rarity, level, [{ target: 'foco', op: 'add', value: 1 }]);
      return labBenchView(g.state, g.content).slots.find((s) => s.slot === 'setup')!.item!.recycleValue;
    };
    expect([view('comum', 1), view('incomum', 1), view('raro', 1), view('epico', 1), view('lendario', 1)]).toEqual([5, 12, 30, 80, 250]);
    expect(view('raro', 11)).toBe(60);
  });

  it('buys nodes with Commits, in order, up to their max level', () => {
    const g = started();
    g.state.lab.commits = 1000;
    expect(buyLabNode(g.state, g.content, 'estudo-de-chefao', T0, g.emit)).toBe(false); // the parent is missing
    expect(buyLabNode(g.state, g.content, 'no-such-node', T0, g.emit)).toBe(false);
    expect(buyLabNode(g.state, g.content, 'algoritmos-eficientes', T0, g.emit)).toBe(true);
    expect(g.state.lab.commits).toBe(992);
    expect(g.state.lab.tree['algoritmos-eficientes']).toBe(1);
    expect(buyLabNode(g.state, g.content, 'algoritmos-eficientes', T0, g.emit)).toBe(true);
    expect(g.state.lab.commits).toBe(992 - 12); // ceil(8 x 1.4)
    expect(buyLabNode(g.state, g.content, 'estudo-de-chefao', T0, g.emit)).toBe(true);
    for (let i = 0; i < 20; i += 1) buyLabNode(g.state, g.content, 'algoritmos-eficientes', T0, g.emit);
    expect(g.state.lab.tree['algoritmos-eficientes']).toBe(10);

    g.state.lab.commits = 0;
    expect(buyLabNode(g.state, g.content, 'monitor-reforcado', T0, g.emit)).toBe(false);
    const view = labTreeView(g.state, g.content);
    expect(view.nodes.find((n) => n.id === 'algoritmos-eficientes')).toMatchObject({ level: 10, maxed: true, cost: null });
    expect(view.spent).toBeGreaterThan(0);
  });

  it('starts power +10% per level, integrity +10 per level and a repair after each boss', () => {
    const g = started();
    g.state.lab.commits = 10_000;
    buyLabNode(g.state, g.content, 'algoritmos-eficientes', T0, g.emit);
    expect(autoDps(labTotals(g.state, g.content), false)).toBeCloseTo(5.5);
    buyLabNode(g.state, g.content, 'monitor-reforcado', T0, g.emit);
    buyLabNode(g.state, g.content, 'monitor-reforcado', T0, g.emit);
    expect(run(g)).toMatchObject({ maxIntegrity: 120, integrity: 120 }); // a rise fills the new room
    buyLabNode(g.state, g.content, 'backup-noturno', T0, g.emit);
    run(g).phase = 5;
    spawnPhase(g.state, g.content, labTotals(g.state, g.content));
    run(g).integrity = 50;
    clearPhase(g);
    expect(run(g).integrity).toBeCloseTo(50 + 120 * 0.05, 3);
    expect(run(g).bosses).toBe(1);
    expect(types(g)).toEqual(expect.arrayContaining(['labBossBeaten', 'labNodeBought']));
  });

  it('adds 5 s to the boss timer per level and a comum Setup item at the start of the run', () => {
    const a = started(1, (game) => {
      game.state.lab.tree['prazo-folgado'] = 2;
      game.state.lab.tree['setup-de-casa'] = 1;
    });
    expect(Object.keys(a.state.lab.turma.equipped).sort()).toEqual(['ferramenta', 'setup']);
    expect(a.state.lab.turma.equipped.setup).toMatchObject({ rarity: 'comum', level: 1 });
    run(a).phase = 5;
    spawnPhase(a.state, a.content, labTotals(a.state, a.content));
    expect(run(a).bossLeft).toBe(40);
  });

  it('adds +20% Commits per level to what a break pays', () => {
    const g = started();
    g.state.lab.tree['portfolio-do-lab'] = 2;
    run(g).cleared = 10;
    breakRun(g.state, g.content, 'integrity', g.emit);
    expect(g.state.lab.commits).toBe(Math.floor(30 * 1.4));
  });
});

// ---------------------------------------------------------------------------
// Graduation
// ---------------------------------------------------------------------------

describe('graduation', () => {
  function ready() {
    const g = started(321);
    hire(g.state, 'angelo');
    g.state.runCoins = new Decimal(1e6);
    return g;
  }

  it('wipes the run, the equipped items and the run buffs', () => {
    const g = ready();
    clearPhase(g);
    run(g).offers = [{ kind: 'buff', buff: 'stack-overflow' }];
    chooseLabReward(g.state, g.content, 0, T0, g.emit);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'epico', 4, [{ target: 'logica', op: 'add', value: 3 }]);
    expect(computeStats(g.state, g.content).clickPower).toBeGreaterThan(1.3);

    expect(graduate(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.lab.turma).toEqual({ run: null, equipped: {}, nextUid: 1 });
    expect(g.state.lab.open).toBe(false);
    expect(computeStats(g.state, g.content).clickPower).toBe(1);
    expect(labTotals(g.state, g.content).power).toBe(0);
  });

  it('keeps the unlock, the Commits, the tree and the records, and opens the lab to a new run', () => {
    const g = ready();
    g.state.lab.tree['algoritmos-eficientes'] = 2;
    g.state.lab.commits = 40;
    run(g).phase = 9;
    run(g).status = 'broken';
    g.state.lab.bestPhase = 9;
    graduate(g.state, g.content, T0, g.emit);
    expect(g.state.lab).toMatchObject({ unlocked: true, commits: 40, bestPhase: 9, tree: { 'algoritmos-eficientes': 2 } });
    expect(labRunAvailable(g.state, g.content).ok).toBe(false); // levels were reset: the gate is per turma
    allAulas(g);
    expect(startLabRun(g.state, g.content, 4, T0, g.emit)).toBe(true);
    expect(g.state.lab.counters.runs).toBe(2);
  });

  it('pays the Commits of a run that was still going', () => {
    const g = ready();
    run(g).cleared = 4;
    graduate(g.state, g.content, T0, g.emit);
    expect(g.state.lab.commits).toBe(12);
    // a run that already broke was paid at the break: nothing more
    const h = ready();
    run(h).cleared = 4;
    breakRun(h.state, h.content, 'integrity', h.emit);
    graduate(h.state, h.content, T0, h.emit);
    expect(h.state.lab.commits).toBe(12);
  });

  it('is not blocked by the diploma tree actions', () => {
    const g = ready();
    expect(buyPrestigeNode(g.state, g.content, 'no-such-node', T0, g.emit)).toBe(false);
    expect(g.state.lab.turma.run).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

describe('save', () => {
  function played(): TestGame {
    const g = started(4242);
    g.state.lab.commits = 33;
    g.state.lab.tree = { 'algoritmos-eficientes': 2, 'monitor-reforcado': 1 };
    clearPhase(g);
    chooseLabReward(g.state, g.content, 0, T0, g.emit);
    if (run(g).status === 'equip') equipLabPending(g.state, g.content, T0, g.emit);
    run(g).buffs['code-review'] = 2;
    for (let i = 0; i < 3; i += 1) labClick(g.state, g.content, T0 + i, g.emit);
    advanceLab(g.state, g.content, 1.55, g.emit);
    setLabOpen(g.state, false);
    return g;
  }

  it('round-trips the whole lab', () => {
    const g = played();
    const loaded = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(loaded.lab).toEqual(g.state.lab);
    expect(loaded.lab.turma.run!.phase).toBe(run(g).phase);
    // and keeps playing the same way
    setLabOpen(g.state, true);
    setLabOpen(loaded, true);
    advanceLab(g.state, g.content, 1, g.emit);
    advanceLab(loaded, g.content, 1, g.emit);
    expect(loaded.lab.turma.run).toEqual(g.state.lab.turma.run);
  });

  it('never loads open', () => {
    const g = played();
    setLabOpen(g.state, true);
    const loaded = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(loaded.lab.open).toBe(false);
  });

  it('loads an old save, without a lab, as a locked and empty one', () => {
    const g = played();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.lab;
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(loaded.lab).toEqual({
      unlocked: false,
      open: false,
      commits: 0,
      tree: {},
      bestPhase: 0,
      counters: loaded.lab.counters,
      turma: { run: null, equipped: {}, nextUid: 1 },
    });
    expect(loaded.lab.counters.runs).toBe(0);
  });

  it('falls back on garbage and clamps what was forged', () => {
    const g = played();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    const lab: Record<string, unknown> = {
      unlocked: 'yes',
      commits: -5,
      bestPhase: 'many',
      tree: { 'algoritmos-eficientes': 99, nope: 3, 'monitor-reforcado': -2 },
      counters: { runs: 'x', clicks: -4 },
      turma: {
        nextUid: 'a',
        equipped: {
          ferramenta: { uid: 1, base: 'notebook-velho', rarity: 'lendario', level: 999, affixes: [{ target: 'logica', op: 'add', value: 9999 }] },
          setup: { base: 'notebook-velho', rarity: 'comum', level: 1, affixes: [{ target: 'logica', op: 'add', value: 1 }] }, // wrong slot
          amuleto: { base: 'nope' },
          acessorio: 'junk',
        },
        run: { status: 'fighting', seed: 'abc', phase: -4, integrity: 1e9, mobs: [{ def: 'ghost', hp: 5 }], buffs: { 'stack-overflow': 500, ghost: 2 } },
      },
    };
    raw.lab = lab;
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(loaded).not.toBeNull();
    expect(loaded.lab.unlocked).toBe(false); // only a real true unlocks it
    expect(loaded.lab.commits).toBe(0);
    expect(loaded.lab.bestPhase).toBe(0);
    // a run cannot live in a lab that is not unlocked
    expect(loaded.lab.turma.run).toBeNull();

    lab.unlocked = true;
    const again = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(again.lab.tree).toEqual({ 'algoritmos-eficientes': 10 });
    const forged = again.lab.turma.equipped.ferramenta!;
    expect(forged.level).toBe(g.content.lab.items.maxLevel);
    expect(forged.affixes[0]!.value).toBeLessThanOrEqual(4 * 2.5);
    expect(again.lab.turma.equipped.setup).toBeUndefined();
    expect(again.lab.turma.equipped.amuleto).toBeUndefined();
    const forgedRun = again.lab.turma.run!;
    expect(forgedRun.buffs).toEqual({ 'stack-overflow': 99 });
    expect(forgedRun.phase).toBe(1);
    expect(forgedRun.integrity).toBeLessThanOrEqual(forgedRun.maxIntegrity);
    expect(forgedRun.mobs.length).toBeGreaterThan(0); // the wave was rebuilt
    expect(again.lab.turma.nextUid).toBeGreaterThan(1);
  });

  it('puts a run with a missing reward back on its feet', () => {
    const g = started(8);
    clearPhase(g);
    const raw = JSON.parse(serializeState(g.state)) as { lab: { turma: { run: Record<string, unknown> } } };
    raw.lab.turma.run.offers = [];
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(loaded.lab.turma.run!.offers).toEqual(run(g).offers); // same seed, same phase: the same options
    raw.lab.turma.run.status = 'equip';
    raw.lab.turma.run.pending = null;
    const moved = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(moved.lab.turma.run!.status).toBe('fighting');
    expect(moved.lab.turma.run!.phase).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

/** A simple player: takes the strongest item for its slot, a buff for damage, repairs when hurt; spends no ADScoins. */
function bot(seed: number, tree: Record<string, number>): { phase: number; seconds: number } {
  const g = labGame();
  unlockLab(g.state, g.content, T0, g.emit);
  allAulas(g);
  g.state.lab.tree = { ...tree };
  startLabRun(g.state, g.content, seed, T0, g.emit);
  const slotOf = (id: string) => labIndex(g.content).bases.get(id)!.slot;
  let now = T0;
  for (let guard = 0; guard < 20_000 && run(g).status !== 'broken'; guard += 1) {
    const current = run(g);
    if (current.status === 'fighting') {
      for (let c = 0; c < 5; c += 1) labClick(g.state, g.content, (now += 200), g.emit);
      advanceLab(g.state, g.content, 1, g.emit);
    } else if (current.status === 'reward') {
      let best = 0;
      let bestScore = -1;
      current.offers.forEach((offer, index) => {
        let score = 3;
        if (offer.kind === 'item') {
          const held = g.state.lab.turma.equipped[slotOf(offer.item.base)];
          score = held ? 10 * (itemPower(g.content, offer.item) / itemPower(g.content, held)) : 50;
        } else if (offer.kind === 'buff') {
          score = 8 + (labIndex(g.content).buffs.get(offer.buff)?.lab.damage ?? 0) * 20;
        } else if (offer.kind === 'repair') {
          score = current.integrity < current.maxIntegrity / 2 ? 40 : 2;
        }
        if (score > bestScore) [best, bestScore] = [index, score];
      });
      chooseLabReward(g.state, g.content, best, T0, g.emit);
    } else {
      const pending = current.pending!;
      const held = g.state.lab.turma.equipped[slotOf(pending.base)]!;
      if (itemPower(g.content, pending) > itemPower(g.content, held)) equipLabPending(g.state, g.content, T0, g.emit);
      else recycleLabPending(g.state, g.content, T0, g.emit);
    }
  }
  return { phase: run(g).phase, seconds: run(g).t };
}

describe('pacing', () => {
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const BIG = { 'algoritmos-eficientes': 10, 'estudo-de-chefao': 5, 'monitor-reforcado': 10, 'backup-noturno': 5, 'prazo-folgado': 4, 'rede-segura': 5, 'codigo-limpo': 6 };

  it('a first run reaches a dozen phases or so, a full tree goes much deeper, and a run lasts minutes, not seconds', () => {
    const plain = Array.from({ length: 12 }, (_, i) => bot(1000 + i * 17, {}));
    const deep = Array.from({ length: 12 }, (_, i) => bot(1000 + i * 17, BIG));
    expect(median(plain.map((r) => r.phase))).toBeGreaterThanOrEqual(8);
    expect(median(plain.map((r) => r.phase))).toBeLessThanOrEqual(25);
    expect(median(deep.map((r) => r.phase))).toBeGreaterThan(median(plain.map((r) => r.phase)) + 5);
    expect(median(plain.map((r) => r.seconds))).toBeGreaterThan(60);
    // every run ends: the monitor always breaks
    for (const result of [...plain, ...deep]) expect(result.phase).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

describe('views', () => {
  it('describe the monitor, the bench and the slot', () => {
    const g = started(6);
    const monitor = labMonitorView(g.state, g.content);
    expect(monitor).toMatchObject({ hasRun: true, status: 'fighting', phase: 1, boss: false, integrityFraction: 1, autoDps: 5, clicksPerSecond: 5 });
    expect(monitor.clickDpsCap).toBeCloseTo(1);
    expect(monitor.mobs.length).toBeGreaterThanOrEqual(2);
    const bench = labBenchView(g.state, g.content);
    expect(bench.slots.map((s) => s.slot)).toEqual([...LAB_SLOTS]);
    expect(bench.slots[0]!.item).toMatchObject({ name: 'Mouse quebrado', power: 5, rarity: 'comum', affixes: [] });
    expect(bench.slots[1]!.item).toBeNull();
    expect(bench.power).toBe(5);
    expect(labSlotView(g.state, g.content)).toMatchObject({ visible: true, unlocked: true, hasRun: true, open: true });
  });

  it('list what an equipped item gives the clicker in pt-BR', () => {
    const g = started(6);
    g.state.lab.turma.equipped.setup = item('cadeira-ergonomica', 'raro', 1, [{ target: 'foco', op: 'add', value: 20 }, { target: 'sorte', op: 'add', value: 5 }]);
    const view = labBenchView(g.state, g.content);
    const setup = view.slots[1]!.item!;
    expect(setup.affixes[0]!.lines[0]).toEqual({ label: 'Duração das habilidades', text: '+6%' });
    expect(setup.affixes[1]!.lines[0]).toEqual({ label: 'Sorte', text: '+5' });
    expect(view.clicker).toEqual([{ label: 'Duração das habilidades', text: '+6%' }]);
  });
});
