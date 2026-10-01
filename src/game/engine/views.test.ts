import { describe, expect, it } from 'vitest';
import { buyDiscipline, buyResearch, setBuyAmount } from './actions';
import { Decimal } from './decimal';
import {
  clickUpgradeViews,
  clickValue,
  coinsPerSecond,
  comboInfo,
  disciplineViews,
  levelledView,
  professorViews,
  researchViews,
} from './views';
import { coins, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

describe('discipline views', () => {
  it('describes an unlocked discipline before the first purchase', () => {
    const g = newCleanGame();
    coins(g.state, 25);
    const cafe = disciplineViews(g.state, g.content).find((v) => v.id === 'cafe')!;
    expect(cafe).toMatchObject({
      kind: 'discipline',
      professor: 'edecio',
      level: 0,
      unlocked: true,
      lockReason: null,
      buyCount: 1,
      affordable: true,
      nextMilestone: 10,
      milestoneProgress: 0,
      share: 0,
    });
    expect(num(cafe.cost)).toBe(10);
    expect(num(cafe.output)).toBe(0);
    expect(num(cafe.outputGain)).toBeCloseTo(1.5); // on stage: x1.5
  });

  it('is not affordable without the coins and shows the real price', () => {
    const g = newCleanGame();
    coins(g.state, 9);
    const cafe = levelledView(g.state, g.content, 'cafe')!;
    expect(cafe.affordable).toBe(false);
    expect(num(cafe.cost)).toBe(10);
  });

  it('gives ready-to-show lock reasons in pt-BR', () => {
    const g = newCleanGame();
    const byId = Object.fromEntries(disciplineViews(g.state, g.content).map((v) => [v.id, v]));
    expect(byId['muito-legal']).toMatchObject({ unlocked: false, lockReason: 'Requer Nome cafe no nível 10', affordable: false });
    expect(byId['sql']).toMatchObject({ unlocked: false, lockReason: 'Contrate GLADIMIR' });
    g.state.levels['cafe'] = 10;
    expect(levelledView(g.state, g.content, 'muito-legal')).toMatchObject({ unlocked: true, lockReason: null });
  });

  it('tracks milestone progress and the output of the next purchase', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 5;
    const cafe = levelledView(g.state, g.content, 'cafe')!;
    expect(cafe.nextMilestone).toBe(10);
    expect(cafe.milestoneProgress).toBeCloseTo(0.5);
    expect(num(cafe.output)).toBeCloseTo(5 * 1.5);

    g.state.levels['cafe'] = 9;
    const edge = levelledView(g.state, g.content, 'cafe')!;
    // level 10 doubles the output: gain = (10 x 2 - 9) x 1.5
    expect(num(edge.outputGain)).toBeCloseTo((20 - 9) * 1.5);

    g.state.levels['cafe'] = 30;
    expect(levelledView(g.state, g.content, 'cafe')).toMatchObject({ nextMilestone: 50, milestoneProgress: 5 / 25 });
  });

  it('reports the share of the total production', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    g.state.levels = { cafe: 10, sql: 10 };
    const views = disciplineViews(g.state, g.content);
    const shares = views.map((v) => v.share);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const cafe = views.find((v) => v.id === 'cafe')!;
    expect(cafe.share).toBeCloseTo(num(cafe.output) / num(coinsPerSecond(g.state, g.content)));
  });

  it('follows the buy amount', () => {
    const g = newCleanGame();
    hire(g.state, 'b2');
    coins(g.state, 1e6);
    setBuyAmount(g.state, g.content, 10);
    const ten = levelledView(g.state, g.content, 'cafe')!;
    expect(ten.buyCount).toBe(10);
    expect(num(ten.cost)).toBeCloseTo(10 * ((1.15 ** 10 - 1) / 0.15), 4);

    setBuyAmount(g.state, g.content, 'max');
    const max = levelledView(g.state, g.content, 'cafe')!;
    expect(max.buyCount).toBeGreaterThan(10);
    expect(max.affordable).toBe(true);

    coins(g.state, 1);
    const broke = levelledView(g.state, g.content, 'cafe')!;
    expect(broke.buyCount).toBe(1); // at least 1, even unaffordable
    expect(broke.affordable).toBe(false);
  });

  it('shows click upgrades with their click output', () => {
    const g = newCleanGame();
    g.state.levels['joinha'] = 4;
    g.state.research['r-clickpower'] = true;
    const joinha = clickUpgradeViews(g.state, g.content).find((v) => v.id === 'joinha')!;
    expect(joinha.kind).toBe('clickUpgrade');
    expect(num(joinha.output)).toBe(8); // 4 x 1 x clickPower 2
    expect(num(joinha.outputGain)).toBe(2);
    const turbo = clickUpgradeViews(g.state, g.content).find((v) => v.id === 'turbo')!;
    expect(turbo).toMatchObject({ unlocked: false, lockReason: 'Requer Nome cafe no nível 5' });
  });
});

describe('selectors', () => {
  it('coinsPerSecond and clickValue match the engine', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10;
    g.state.levels['joinha'] = 2;
    expect(num(coinsPerSecond(g.state, g.content))).toBeCloseTo(30);
    expect(num(clickValue(g.state, g.content))).toBe(3);
  });

  it('refresh after an action on the same state reference', () => {
    const g = newCleanGame();
    coins(g.state, 1e6);
    expect(num(coinsPerSecond(g.state, g.content))).toBe(0);
    buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    expect(num(coinsPerSecond(g.state, g.content))).toBeCloseTo(1.5);
    buyResearch(g.state, g.content, 'r-disc-cafe', T0, g.emit);
    expect(num(coinsPerSecond(g.state, g.content))).toBeCloseTo(4.5);
  });

  it('reports the combo', () => {
    const g = newCleanGame();
    g.state.combo.steps = 10.6;
    expect(comboInfo(g.state, g.content)).toMatchObject({ steps: 10, max: 20, unlocked: true });
    expect(comboInfo(g.state, g.content).multiplier).toBeCloseTo(1.53);
  });
});

describe('professor views', () => {
  it('lists professors in hire order with lock reasons', () => {
    const g = newCleanGame();
    coins(g.state, 1e9);
    const views = professorViews(g.state, g.content);
    expect(views.map((v) => v.id)).toEqual(['edecio', 'gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo', 'pablo']);
    expect(views[0]).toMatchObject({ hired: true, active: true, canBeHired: false, lockReason: null, equippedSkin: 'edecio-default' });
    expect(views[1]).toMatchObject({ hired: false, canBeHired: true, affordable: true, lockReason: null });
    expect(num(views[1]!.hireCost)).toBe(100);
    expect(views[2]).toMatchObject({ canBeHired: false, affordable: false, lockReason: 'Contrate GLADIMIR primeiro' });
  });

  it('shows the extra requirement of the last professor', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo');
    const pablo = professorViews(g.state, g.content).find((v) => v.id === 'pablo')!;
    expect(pablo).toMatchObject({ canBeHired: false, lockReason: 'Requer 1 formatura' });
    g.state.counters.graduations = 1;
    expect(professorViews(g.state, g.content).find((v) => v.id === 'pablo')).toMatchObject({ canBeHired: true, lockReason: null });
  });

  it('reports each professor production', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    g.state.levels = { cafe: 10, sql: 10 }; // 30/s on stage; sql 3 x 10 x 2 = 60
    const views = professorViews(g.state, g.content);
    expect(num(views[0]!.production)).toBeCloseTo(30);
    expect(num(views[1]!.production)).toBeCloseTo(60);
    expect(num(views[2]!.production)).toBe(0);
  });
});

describe('research views', () => {
  it('flags visibility, affordability and bought', () => {
    const g = newCleanGame();
    coins(g.state, 75);
    let views = Object.fromEntries(researchViews(g.state, g.content).map((v) => [v.id, v]));
    expect(views['r-clickpower']).toMatchObject({ visible: true, affordable: true, bought: false });
    expect(views['r-crit']).toMatchObject({ visible: false, affordable: false }); // needs r-clickpower
    expect(views['r-offline']).toMatchObject({ visible: false }); // Gladimir not hired
    expect(views['r-global']).toMatchObject({ affordable: true });
    g.state.research['r-clickpower'] = true;
    views = Object.fromEntries(researchViews(g.state, g.content).map((v) => [v.id, v]));
    expect(views['r-clickpower']).toMatchObject({ bought: true, affordable: false });
    expect(views['r-crit']).toMatchObject({ visible: true, affordable: false }); // costs 100
    expect(views['r-crit']!.cost).toEqual(new Decimal(100));
  });
});
