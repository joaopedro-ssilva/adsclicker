import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { labDecor, labStartItems } from '../../content/labCosmetics';
import { hire, newCleanGame, T0 } from '../__fixtures__/helpers';
import type { TestGame } from '../__fixtures__/helpers';
import { playBot } from '../__fixtures__/labBot';
import { Decimal, parseDecimal } from '../decimal';
import { deserializeState, serializeState } from '../save';
import { buyLabCosmetic, equipLabCosmetic, startLabRun, unlockLab } from './actions';
import { clickDamage } from './run';
import { grantLabCosmetic, labCosmeticPrice, labStarterId } from './cosmetics';
import { labTotals } from './effects';
import { itemPower } from './items';
import { createLabCosmetics } from './state';

function game(): TestGame {
  const g = newCleanGame();
  hire(g.state, 'pablo');
  g.state.diplomas = 150;
  g.state.diplomasEarned = 150;
  unlockLab(g.state, g.content, T0, g.emit);
  for (const def of g.content.disciplines) g.state.levels[def.id] = 1;
  return g;
}

const buy = (g: TestGame, id: string) => buyLabCosmetic(g.state, g.content, id, T0, g.emit);
const equip = (g: TestGame, id: string, on = true) => equipLabCosmetic(g.state, g.content, id, on, T0, g.emit);
const rich = (g: TestGame) => {
  g.state.coins = new Decimal('1e60');
};

describe('lab cosmetics: content', () => {
  const { items, defaults, decorMax } = content.lab.cosmetics;

  it('has the full wardrobe with unique ids and the defaults free', () => {
    expect(new Set(items.map((entry) => entry.id)).size).toBe(items.length);
    expect(items.filter((entry) => entry.kind === 'monitor')).toHaveLength(5);
    expect(items.filter((entry) => entry.kind === 'theme')).toHaveLength(5);
    expect(items.filter((entry) => entry.kind === 'decor')).toHaveLength(labDecor.length);
    expect(items.filter((entry) => entry.kind === 'start')).toHaveLength(labStartItems.length + 1);
    for (const id of Object.values(defaults)) expect(items.find((entry) => entry.id === id)?.free).toBe(true);
    // the state factory spells the same defaults
    expect(createLabCosmetics()).toEqual({
      owned: {},
      ...{
        monitor: defaults.monitor,
        theme: defaults.theme,
        startItem: defaults.startItem,
      },
      decor: [],
    });
    expect(decorMax).toBeGreaterThanOrEqual(3);
  });

  it('prices every shop item in the coin-sink range, and marks the rest as achievement rewards', () => {
    const range: Record<string, [number, number]> = {
      decor: [27, 33],
      monitor: [33, 42],
      theme: [33, 42],
      start: [36, 45],
    };
    for (const entry of items.filter((candidate) => candidate.price)) {
      const exponent = Math.log10(parseDecimal(entry.price!).toNumber());
      expect(exponent, entry.id).toBeGreaterThanOrEqual(range[entry.kind]![0]);
      expect(exponent, entry.id).toBeLessThanOrEqual(range[entry.kind]![1] + 1e-9);
    }
    const locked = items.filter((entry) => !entry.price && !entry.free);
    expect(locked.length).toBeGreaterThanOrEqual(3);
    for (const entry of locked) expect(entry.hint, entry.id).toBeTruthy();
  });

  it('gives each starting item the same power as the Mouse quebrado and a small effect', () => {
    for (const entry of labStartItems) {
      const base = content.lab.bases.find((candidate) => candidate.id === entry.id)!;
      expect(base.slot).toBe('ferramenta');
      expect(base.drops).toBe(false);
      expect(base.affixes).toBe(false);
      expect(base.effects, entry.id).toBeDefined();
    }
    expect(content.lab.bases.find((candidate) => candidate.id === content.lab.starter)?.effects).toBeUndefined();
  });
});

describe('lab cosmetics: buying and wearing', () => {
  it('buys with ADScoins once, keeps it forever, and refuses what is not for sale or too dear', () => {
    const g = game();
    const price = labCosmeticPrice(g.content, 'cacto')!;
    expect(buy(g, 'cacto')).toBe(false); // no coins
    g.state.coins = price.mul(3);
    expect(buy(g, 'cacto')).toBe(true);
    expect(g.state.coins.eq(price.mul(2))).toBe(true);
    expect(g.state.lab.cosmetics.owned.cacto).toBe(true);
    expect(g.events.map((event) => event.type)).toContain('labCosmeticGained');
    expect(buy(g, 'cacto')).toBe(false); // owned
    expect(buy(g, 'gato-dormindo-no-monitor')).toBe(false); // achievement only
    expect(buy(g, 'monitor-crt-bege')).toBe(false); // a free default
    expect(buy(g, 'nao-existe')).toBe(false);
    expect(g.state.coins.eq(price.mul(2))).toBe(true);
  });

  it('keeps the wardrobe through graduation', () => {
    const g = game();
    rich(g);
    expect(buy(g, 'monitor-gamer-rgb')).toBe(true);
    expect(equip(g, 'monitor-gamer-rgb')).toBe(true);
    const back = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(back.lab.cosmetics.owned['monitor-gamer-rgb']).toBe(true);
    expect(back.lab.cosmetics.monitor).toBe('monitor-gamer-rgb');
  });

  it('equips only what is owned, one skin/theme/start item at a time', () => {
    const g = game();
    expect(equip(g, 'monitor-tela-azul')).toBe(false); // not owned
    rich(g);
    buy(g, 'monitor-tela-azul');
    buy(g, 'tema-madrugada');
    expect(equip(g, 'monitor-tela-azul')).toBe(true);
    expect(equip(g, 'tema-madrugada')).toBe(true);
    expect(g.state.lab.cosmetics).toMatchObject({
      monitor: 'monitor-tela-azul',
      theme: 'tema-madrugada',
    });
    expect(equip(g, 'monitor-crt-bege')).toBe(true); // the free default is always there
    expect(equip(g, 'monitor-crt-bege', false)).toBe(false); // cannot be taken off, only swapped
    expect(g.state.lab.cosmetics.monitor).toBe('monitor-crt-bege');
  });

  it('limits the decorations on display and lets them come off', () => {
    const g = game();
    rich(g);
    const ids = labDecor
      .slice(0, g.content.lab.cosmetics.decorMax + 2)
      .map((entry) => entry.id)
      .filter((id) => labCosmeticPrice(g.content, id));
    for (const id of ids) expect(buy(g, id)).toBe(true);
    const max = g.content.lab.cosmetics.decorMax;
    ids.slice(0, max).forEach((id) => expect(equip(g, id)).toBe(true));
    expect(equip(g, ids[0]!)).toBe(false); // already on
    if (ids.length > max) expect(equip(g, ids[max]!)).toBe(false); // full
    expect(g.state.lab.cosmetics.decor).toHaveLength(Math.min(max, ids.length));
    expect(equip(g, ids[0]!, false)).toBe(true);
    expect(g.state.lab.cosmetics.decor).not.toContain(ids[0]);
  });

  it('grants a cosmetic for free (the achievement reward), once', () => {
    const g = game();
    expect(grantLabCosmetic(g.state, g.content, 'gato-dormindo-no-monitor', g.emit)).toBe(true);
    expect(grantLabCosmetic(g.state, g.content, 'gato-dormindo-no-monitor', g.emit)).toBe(false);
    expect(grantLabCosmetic(g.state, g.content, 'monitor-crt-bege', g.emit)).toBe(false);
    expect(grantLabCosmetic(g.state, g.content, 'nao-existe', g.emit)).toBe(false);
    expect(g.state.coins.eq(0)).toBe(true);
    expect(equip(g, 'gato-dormindo-no-monitor')).toBe(true);
    expect(g.events.filter((event) => event.type === 'labCosmeticGained')).toHaveLength(1);
  });
});

describe('lab cosmetics: the starting item', () => {
  it('replaces the Mouse quebrado at the run start, with the same power and its small effect', () => {
    const g = game();
    grantLabCosmetic(g.state, g.content, 'mousepad-gamer-rgb');
    rich(g);
    buy(g, 'mouse-dourado');
    expect(equip(g, 'mouse-dourado')).toBe(true);
    const plain = game();
    startLabRun(plain.state, plain.content, 7, T0, plain.emit);
    expect(startLabRun(g.state, g.content, 7, T0, g.emit)).toBe(true);
    const tool = g.state.lab.turma.equipped.ferramenta!;
    expect(tool.base).toBe('mouse-dourado');
    expect(tool.affixes).toEqual([]);
    expect(itemPower(g.content, tool)).toBe(itemPower(g.content, plain.state.lab.turma.equipped.ferramenta!));
    expect(labTotals(g.state, g.content).lab.commits).toBeCloseTo(0.1);
    expect(labTotals(plain.state, plain.content).lab.commits).toBe(0);
  });

  it('applies each effect', () => {
    const totalsWith = (id: string, mutate?: (g: TestGame) => void) => {
      const g = game();
      mutate?.(g);
      grantLabCosmetic(g.state, g.content, id);
      equip(g, id);
      startLabRun(g.state, g.content, 3, T0, g.emit);
      return {
        g,
        totals: labTotals(g.state, g.content),
        run: g.state.lab.turma.run!,
      };
    };
    const base = totalsWith('mouse-quebrado');
    const fita = totalsWith('mouse-com-fita-colorida');
    expect(fita.run.maxIntegrity).toBe(base.run.maxIntegrity + 10);
    expect(totalsWith('mouse-de-bolinha').totals.lab.luck).toBe(5);
    const track = totalsWith('trackball');
    expect(track.totals.lab.damage).toBeCloseTo(0.06);
    const kbd = totalsWith('teclado-de-membrana-velho');
    expect(kbd.totals.lab.firstBossTime).toBe(1);
    const pad = totalsWith('mousepad-gamer-rgb');
    expect(clickDamage(pad.g.content, pad.totals, false) / clickDamage(base.g.content, base.totals, false)).toBeCloseTo(1.1);
  });

  it('falls back to the Mouse quebrado for an unknown, unowned or wrong-kind id', () => {
    const g = game();
    for (const id of ['nao-existe', 'trackball', 'cacto', 'monitor-tela-azul']) {
      g.state.lab.cosmetics.startItem = id;
      expect(labStarterId(g.state, g.content)).toBe('mouse-quebrado');
    }
  });

  it('drops unknown or unowned ids when reading a save, and reads an old save without the field', () => {
    const g = game();
    const raw = JSON.parse(serializeState(g.state)) as {
      lab: Record<string, unknown>;
    };
    raw.lab.cosmetics = {
      owned: {
        cacto: true,
        'sumiu-do-jogo': true,
        'monitor-crt-bege': true,
        trackball: 'sim',
      },
      monitor: 'monitor-ultrawide', // not owned
      theme: 'cacto', // wrong kind
      startItem: 'trackball', // flagged with a non-true value: not owned
      decor: ['cacto', 'cacto', 'luminaria', 'sumiu-do-jogo', 7],
    };
    const back = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(back.lab.cosmetics).toEqual({
      owned: { cacto: true },
      monitor: 'monitor-crt-bege',
      theme: 'tema-fosforo',
      decor: ['cacto'],
      startItem: 'mouse-quebrado',
    });

    delete raw.lab.cosmetics;
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.lab.cosmetics).toEqual(createLabCosmetics());
    raw.lab.cosmetics = 'lixo';
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.lab.cosmetics).toEqual(createLabCosmetics());
  });

  it('caps the decorations a save can wear', () => {
    const g = game();
    const owned = Object.fromEntries(labDecor.map((entry) => [entry.id, true]));
    const raw = JSON.parse(serializeState(g.state)) as {
      lab: Record<string, unknown>;
    };
    raw.lab.cosmetics = { owned, decor: labDecor.map((entry) => entry.id) };
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.lab.cosmetics.decor).toHaveLength(g.content.lab.cosmetics.decorMax);
  });
});

describe('lab cosmetics: first-run pacing stays put with every starting item', () => {
  const seeds = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i * 37);
  const rate = (phases: { bosses: number }[], bosses: number) => phases.filter((r) => r.bosses >= bosses).length / phases.length;

  for (const entry of labStartItems) {
    it(
      entry.name,
      () => {
        const results = seeds(400).map((seed) => playBot(seed, { startItem: entry.id }));
        expect(rate(results, 1)).toBeGreaterThanOrEqual(0.35);
        expect(rate(results, 1)).toBeLessThanOrEqual(0.55);
        expect(rate(results, 2)).toBeLessThan(0.03);
      },
      120_000,
    );
  }
});
