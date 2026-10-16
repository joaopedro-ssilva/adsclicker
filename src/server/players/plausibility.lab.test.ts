import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { LAB_SLOTS } from '@/game/content/labTypes';
import type { LabSlot } from '@/game/content/labTypes';
import { computeStats, deserializeState, serializeState } from '@/game/engine';
import { rollItem } from '@/game/engine/lab';
import type { LabItem } from '@/game/engine/lab';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import type { SimOptions } from '@/game/sim/simulate';
import { roundTrip } from '../testing/play';
import type { Window } from '../testing/play';
import { judgeSave } from './plausibility';

/** The strongest clicker build the lab allows: four level-20 legendaries with the best rolls, every run buff stacked, the tree maxed. */
function maxedLab(state: GameState): void {
  state.hired.pablo = true;
  state.lab.unlocked = true;
  const pick: Record<LabSlot, string> = {
    ferramenta: 'calculadora-cientifica',
    setup: 'cadeira-ergonomica',
    acessorio: 'oculos-luz-azul',
    amuleto: 'adesivo-de-linguagem',
  };
  let uid = 1;
  for (const slot of LAB_SLOTS) {
    const base = content.lab.bases.find((entry) => entry.id === pick[slot])!;
    const item: LabItem = rollItem(content, base, 'lendario', content.lab.items.maxLevel, () => 0.999);
    item.uid = uid++;
    state.lab.turma.equipped[slot] = item;
  }
  for (const node of content.lab.tree) state.lab.tree[node.id] = node.maxLevel;
  state.lab.turma.run = {
    seed: 1, status: 'broken', phase: 40, t: 900, phaseTime: 0, carry: 0, integrity: 0, maxIntegrity: 300, mobs: [], mobSeq: 0, waveHp: 0,
    bossLeft: null, nextCharge: 0, offers: [], pending: null,
    buffs: Object.fromEntries(content.lab.buffs.map((buff) => [buff.id, 6])),
    clickTimes: [], windUsed: 0, cleared: 39, bosses: 7, clearLog: [], brokenBy: 'timer', paid: 0, shield: 0, rerolled: 0,
  };
  state.lab.turma.nextUid = uid;
  // The run above got to phase 40: the counters say so too (the judge ties the record to the phases cleared).
  state.lab.counters.phasesCleared = 39;
  state.lab.counters.bossesBeaten = 7;
}

function windows(options: SimOptions & { windows: number; windowSeconds?: number }, lab: boolean): Window[] {
  const { windows: count, windowSeconds = 45, ...sim } = options;
  const result: Window[] = [];
  let previous: GameState | null = null;
  let live: GameState | undefined;
  for (let i = 0; i < count; i += 1) {
    const run = simulate(content, {
      ...sim,
      from: live,
      setup: lab ? maxedLab : undefined,
      maxSeconds: windowSeconds * (i + 1),
      stopWhenDone: false,
    });
    live = run.finalState;
    const next = roundTrip(live);
    result.push({ previous, next, elapsedMs: windowSeconds * 1000 });
    previous = next;
  }
  return result;
}

describe('judgeSave: Laboratório', () => {
  it('the lab build is real: it raises the clicker stats, and stays inside the caps', () => {
    const plain = simulate(content, { maxSeconds: 5, stopWhenDone: false }).finalState;
    const strong = roundTrip(simulate(content, { maxSeconds: 5, stopWhenDone: false, setup: maxedLab }).finalState);
    const a = computeStats(plain, content);
    const b = computeStats(strong, content);
    expect(b.clickPower).toBeGreaterThan(a.clickPower * 2);
    expect(b.clickPower).toBeLessThanOrEqual(a.clickPower + content.lab.caps.clickPower!);
    expect(b.critChance).toBeLessThanOrEqual(1);
  });

  it('honest play with the strongest lab build passes, with windows of 45 s and of 10 min', () => {
    for (const options of [
      { clicksPerSecond: 14, windows: 40, seed: 3 },
      { clicksPerSecond: 4, windows: 6, windowSeconds: 600, seed: 5, graduate: false },
    ]) {
      const failures = windows(options, true)
        .map((window, index) => ({ index, verdict: judgeSave(window) }))
        .filter(({ verdict }) => !verdict.ok);
      expect(failures).toEqual([]);
    }
  }, 240_000);

  it('a graduation that wipes the build does not look like a cheat either', () => {
    const all = windows({ clicksPerSecond: 8, windows: 30, seed: 7 }, true).filter((window) => window.previous !== null);
    for (const window of all) {
      // the save after a graduation has no items: the same window judged with the lab emptied
      const wiped = roundTrip(window.next);
      wiped.lab.turma = { run: null, equipped: {}, nextUid: 1 };
      expect(judgeSave({ ...window, next: roundTrip(wiped) }).ok).toBe(true);
    }
  }, 240_000);

  it('a forged inventory is clamped on load to what the game could roll', () => {
    const honest = roundTrip(simulate(content, { maxSeconds: 5, stopWhenDone: false, setup: maxedLab }).finalState);
    const text = serializeState(honest);
    const forged = JSON.parse(text) as { lab: { turma: { equipped: Record<string, { level: number; affixes: { value: number }[] }> } } };
    for (const slot of LAB_SLOTS) {
      const slotItem = forged.lab.turma.equipped[slot]!;
      slotItem.level = 5000;
      for (const affix of slotItem.affixes) affix.value = 1e9;
    }
    const loaded = deserializeState(JSON.stringify(forged), content, honest.lastTickAt)!;
    const before = computeStats(honest, content);
    const after = computeStats(loaded, content);
    // a forged number cannot go past a max roll (the level is clamped too), and the caps hold either way
    expect(after.clickPower).toBeLessThanOrEqual(before.clickPower + 1e-9);
    expect(after.clickPower).toBeLessThanOrEqual(1 + content.lab.caps.clickPower! + 1e-9);
    expect(after.critChance).toBeLessThanOrEqual(1);
  });
});
