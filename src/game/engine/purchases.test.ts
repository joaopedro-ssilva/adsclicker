import { describe, expect, it } from 'vitest';
import {
  buyClickUpgrade,
  buyDiscipline,
  buyResearch,
  equipScenery,
  equipSkin,
  equipTheme,
  hireProfessor,
  setActiveProfessor,
  setBuyAmount,
} from './actions';
import { bulkCost } from './formulas';
import { computeStats } from './stats';
import { getIndex } from './contentIndex';
import { coins, eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

describe('buying disciplines', () => {
  it('spends coins, raises the level and reports it', () => {
    const g = newCleanGame();
    coins(g.state, 25);
    expect(buyDiscipline(g.state, g.content, 'cafe', T0, g.emit)).toBe(true);
    expect(g.state.levels['cafe']).toBe(1);
    expect(num(g.state.coins)).toBe(15);
    expect(g.state.counters.levelsBought).toBe(1);
    expect(eventsOf(g.events, 'purchase')[0]).toEqual({ type: 'purchase', kind: 'discipline', id: 'cafe', levels: 1 });
  });

  it('costs more at each level', () => {
    const g = newCleanGame();
    coins(g.state, 1000);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(1000 - 10 - 11.5, 6);
  });

  it('refuses when it cannot be afforded and leaves the state alone', () => {
    const g = newCleanGame();
    coins(g.state, 9);
    expect(buyDiscipline(g.state, g.content, 'cafe', T0, g.emit)).toBe(false);
    expect(g.state.levels['cafe']).toBeUndefined();
    expect(num(g.state.coins)).toBe(9);
    expect(g.events).toEqual([]);
  });

  it('refuses unknown ids and ids of the wrong kind', () => {
    const g = newCleanGame();
    coins(g.state, 1e6);
    expect(buyDiscipline(g.state, g.content, 'nope', T0, g.emit)).toBe(false);
    expect(buyDiscipline(g.state, g.content, 'joinha', T0, g.emit)).toBe(false);
    expect(buyClickUpgrade(g.state, g.content, 'cafe', T0, g.emit)).toBe(false);
  });

  it('unlocks the next tier at level 10 of the previous one', () => {
    const g = newCleanGame();
    coins(g.state, 1e9);
    expect(buyDiscipline(g.state, g.content, 'muito-legal', T0, g.emit)).toBe(false);
    g.state.levels['cafe'] = 9;
    expect(buyDiscipline(g.state, g.content, 'muito-legal', T0, g.emit)).toBe(false);
    g.state.levels['cafe'] = 10;
    expect(buyDiscipline(g.state, g.content, 'muito-legal', T0, g.emit)).toBe(true);
    expect(buyDiscipline(g.state, g.content, 'programacao', T0, g.emit)).toBe(false);
  });

  it('needs the professor hired', () => {
    const g = newCleanGame();
    coins(g.state, 1e9);
    expect(buyDiscipline(g.state, g.content, 'sql', T0, g.emit)).toBe(false);
    hire(g.state, 'gladimir');
    expect(buyDiscipline(g.state, g.content, 'sql', T0, g.emit)).toBe(true);
  });

  it('emits a milestone event when a purchase crosses one', () => {
    const g = newCleanGame();
    coins(g.state, 1e9);
    g.state.levels['cafe'] = 9;
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(eventsOf(g.events, 'milestone')).toEqual([{ type: 'milestone', id: 'cafe', level: 10 }]);
  });
});

describe('buying click upgrades', () => {
  it('honours the requires list', () => {
    const g = newCleanGame();
    coins(g.state, 1e6);
    expect(buyClickUpgrade(g.state, g.content, 'turbo', T0, g.emit)).toBe(false);
    g.state.levels['cafe'] = 5;
    expect(buyClickUpgrade(g.state, g.content, 'turbo', T0, g.emit)).toBe(true);
    expect(eventsOf(g.events, 'purchase').at(-1)).toMatchObject({ kind: 'clickUpgrade', id: 'turbo' });
  });
});

describe('buy amount', () => {
  it('ignores x10 and max without the bulkBuy feature', () => {
    const g = newCleanGame();
    expect(setBuyAmount(g.state, g.content, 10)).toBe(false);
    expect(setBuyAmount(g.state, g.content, 'max')).toBe(false);
    expect(g.state.buyAmount).toBe(1);
    expect(setBuyAmount(g.state, g.content, 1)).toBe(true);
  });

  it('buys 10 levels at the bulk price', () => {
    const g = newCleanGame();
    hire(g.state, 'b2');
    setBuyAmount(g.state, g.content, 10);
    coins(g.state, 1e6);
    const expected = bulkCost(getIndex(g.content).baseCost.get('cafe')!, 0, 10, computeStats(g.state, g.content));
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(g.state.levels['cafe']).toBe(10);
    expect(num(g.state.coins)).toBeCloseTo(1e6 - num(expected), 4);
    expect(g.state.counters.levelsBought).toBe(10);
    expect(eventsOf(g.events, 'purchase')[0]).toMatchObject({ levels: 10 });
  });

  it('refuses x10 when all ten are not affordable', () => {
    const g = newCleanGame();
    hire(g.state, 'b2');
    setBuyAmount(g.state, g.content, 10);
    coins(g.state, 100); // ten levels cost about 203
    expect(buyDiscipline(g.state, g.content, 'cafe', T0, g.emit)).toBe(false);
    expect(g.state.levels['cafe']).toBeUndefined();
  });

  it('buys the maximum affordable', () => {
    const g = newCleanGame();
    hire(g.state, 'b2');
    setBuyAmount(g.state, g.content, 'max');
    coins(g.state, 1000);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    const level = g.state.levels['cafe'] ?? 0;
    const stats = computeStats(g.state, g.content);
    const base = getIndex(g.content).baseCost.get('cafe')!;
    expect(level).toBeGreaterThan(10);
    expect(num(bulkCost(base, 0, level + 1, stats))).toBeGreaterThan(1000);
    expect(num(g.state.coins)).toBeGreaterThanOrEqual(0);
    expect(num(g.state.coins)).toBeLessThan(1000);
  });

  it('falls back to x1 when the feature is lost', () => {
    const g = newCleanGame();
    hire(g.state, 'b2');
    setBuyAmount(g.state, g.content, 10);
    g.state.hired.b2 = false;
    coins(g.state, 1e6);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(g.state.levels['cafe']).toBe(1);
  });

  it('applies costMult from research', () => {
    const g = newCleanGame();
    g.state.research['r-discount'] = true;
    coins(g.state, 5);
    expect(buyDiscipline(g.state, g.content, 'cafe', T0, g.emit)).toBe(true);
    expect(num(g.state.coins)).toBe(0);
  });
});

describe('research', () => {
  it('buys once, counts, and respects requirements', () => {
    const g = newCleanGame();
    coins(g.state, 1e6);
    expect(buyResearch(g.state, g.content, 'r-crit', T0, g.emit)).toBe(false); // needs r-clickpower
    expect(buyResearch(g.state, g.content, 'r-clickpower', T0, g.emit)).toBe(true);
    expect(g.state.research['r-clickpower']).toBe(true);
    expect(g.state.counters.researchBought).toBe(1);
    expect(num(g.state.coins)).toBeCloseTo(1e6 - 50, 4);
    expect(buyResearch(g.state, g.content, 'r-clickpower', T0, g.emit)).toBe(false);
    expect(buyResearch(g.state, g.content, 'r-crit', T0, g.emit)).toBe(true);
    expect(eventsOf(g.events, 'purchase').map((e) => e.id)).toEqual(['r-clickpower', 'r-crit']);
  });

  it('needs the professor hired and enough coins', () => {
    const g = newCleanGame();
    coins(g.state, 1e6);
    expect(buyResearch(g.state, g.content, 'r-offline', T0, g.emit)).toBe(false);
    hire(g.state, 'gladimir');
    coins(g.state, 10);
    expect(buyResearch(g.state, g.content, 'r-offline', T0, g.emit)).toBe(false);
    coins(g.state, 1000);
    expect(buyResearch(g.state, g.content, 'r-offline', T0, g.emit)).toBe(true);
  });
});

describe('hiring', () => {
  it('hires the next professor for coins', () => {
    const g = newCleanGame();
    coins(g.state, 150);
    expect(hireProfessor(g.state, g.content, 'gladimir', T0, g.emit)).toBe(true);
    expect(g.state.hired.gladimir).toBe(true);
    expect(num(g.state.coins)).toBe(50);
    expect(eventsOf(g.events, 'hire')).toEqual([{ type: 'hire', professor: 'gladimir' }]);
  });

  it('cannot hire without enough coins or twice', () => {
    const g = newCleanGame();
    coins(g.state, 99);
    expect(hireProfessor(g.state, g.content, 'gladimir', T0, g.emit)).toBe(false);
    coins(g.state, 1000);
    hireProfessor(g.state, g.content, 'gladimir', T0, g.emit);
    expect(hireProfessor(g.state, g.content, 'gladimir', T0, g.emit)).toBe(false);
    expect(num(g.state.coins)).toBe(900);
  });

  it('enforces the hire order', () => {
    const g = newCleanGame();
    coins(g.state, 1e9);
    expect(hireProfessor(g.state, g.content, 'b2', T0, g.emit)).toBe(false);
    expect(hireProfessor(g.state, g.content, 'angelo', T0, g.emit)).toBe(false);
    hireProfessor(g.state, g.content, 'gladimir', T0, g.emit);
    expect(hireProfessor(g.state, g.content, 'b2', T0, g.emit)).toBe(true);
  });

  it('enforces extra requirements (the last professor needs a graduation)', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo');
    coins(g.state, 1e9);
    expect(hireProfessor(g.state, g.content, 'pablo', T0, g.emit)).toBe(false);
    g.state.counters.graduations = 1;
    expect(hireProfessor(g.state, g.content, 'pablo', T0, g.emit)).toBe(true);
  });
});

describe('professor on stage', () => {
  it('switches between hired professors and counts swaps', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    expect(setActiveProfessor(g.state, g.content, 'gladimir', T0, g.emit)).toBe(true);
    expect(g.state.activeProfessor).toBe('gladimir');
    expect(g.state.counters.professorSwaps).toBe(1);
    setActiveProfessor(g.state, g.content, 'edecio', T0, g.emit);
    expect(g.state.counters.professorSwaps).toBe(2);
  });

  it('ignores professors that are not hired and the one already on stage', () => {
    const g = newCleanGame();
    expect(setActiveProfessor(g.state, g.content, 'b2', T0, g.emit)).toBe(false);
    expect(setActiveProfessor(g.state, g.content, 'edecio', T0, g.emit)).toBe(false);
    expect(g.state.counters.professorSwaps).toBe(0);
    expect(g.state.activeProfessor).toBe('edecio');
  });
});

describe('cosmetics', () => {
  it('equips only what is owned', () => {
    const g = newCleanGame();
    expect(equipSkin(g.state, g.content, 'edecio-cafe')).toBe(false);
    expect(g.state.equippedSkin.edecio).toBe('edecio-default');
    g.state.skins['edecio-cafe'] = true;
    expect(equipSkin(g.state, g.content, 'edecio-cafe')).toBe(true);
    expect(g.state.equippedSkin.edecio).toBe('edecio-cafe');
    expect(equipSkin(g.state, g.content, 'ghost')).toBe(false);

    expect(equipScenery(g.state, g.content, 'laboratorio')).toBe(false);
    g.state.sceneries['laboratorio'] = true;
    expect(equipScenery(g.state, g.content, 'laboratorio')).toBe(true);
    expect(g.state.equippedScenery).toBe('laboratorio');

    expect(equipTheme(g.state, g.content, 'claro')).toBe(false);
    g.state.themes['claro'] = true;
    expect(equipTheme(g.state, g.content, 'claro')).toBe(true);
    expect(g.state.equippedTheme).toBe('claro');
  });

  it('owns the default skin, scenery and theme from the start', () => {
    const g = newCleanGame();
    expect(g.state.skins['gladimir-default']).toBe(true);
    expect(g.state.equippedSkin.pablo).toBe('pablo-default');
    expect(g.state.sceneries['sala']).toBe(true);
    expect(g.state.equippedScenery).toBe('sala');
    expect(g.state.themes['escuro']).toBe(true);
    expect(g.state.equippedTheme).toBe('escuro');
  });
});
