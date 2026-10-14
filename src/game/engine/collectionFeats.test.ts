import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { MONITOR_IDS, PROFESSOR_IDS } from '../content/types';
import type { Condition } from '../content/types';
import type { Emit, GameEvent } from '../store/types';
import { buyDiscipline, graduate } from './actions';
import { achievementDetail } from './achievementDetail';
import { checkAchievements, createProbe, measureCondition } from './achievements';
import { Decimal } from './decimal';
import { createInitialState } from './init';
import { buyAsset, depositFund, fireRollforward, hitSwarmBug, maybeStartGolden, sellAsset, startFesta, startSwarm, updateBolsa, updateSwarm } from './maestria';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { computeStats } from './stats';
import { advance } from './tick';

const T0 = 1_700_000_000_000;

function game() {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  const state = createInitialState(content, T0);
  for (const id of PROFESSOR_IDS) state.hired[id] = true;
  state.counters.graduations = 8;
  state.coins = new Decimal('1e60');
  return { state, events, emit, rng: createRng(5) };
}

const met = (g: ReturnType<typeof game>, condition: Condition) => measureCondition(g.state, content, condition, createProbe(g.state, content));

describe('counters of the Maestria feats', () => {
  it('start at zero, and a save from before them loads with zeros', () => {
    const g = game();
    const raw = JSON.parse(serializeState(g.state)) as { counters: Record<string, number> };
    for (const key of ['goldenModes', 'rollforwards', 'tripleRollforwards', 'swarmsWon', 'swarmsCleared', 'festas', 'bolsaProfitSeconds', 'designFreeLevels', 'cappedGraduations']) {
      expect(g.state.counters[key as keyof typeof g.state.counters], key).toBe(0);
      delete raw.counters[key];
    }
    const loaded = deserializeState(JSON.stringify(raw), content, T0);
    expect(loaded?.counters.goldenModes).toBe(0);
    expect(loaded?.counters.bolsaProfitSeconds).toBe(0);
  });

  it('counts each time the golden mode starts', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1 };
    const stats = computeStats(g.state, content);
    g.state.combo = { steps: stats.comboMax, lastClickAt: T0 };
    expect(maybeStartGolden(g.state, content, stats, T0, g.emit)).toBe(true);
    expect(maybeStartGolden(g.state, content, stats, T0 + 1000, g.emit)).toBe(false); // still running
    expect(g.state.counters.goldenModes).toBe(1);
  });

  it('counts Rollforwards, and the triple ones only with three charges stored', () => {
    const g = game();
    g.state.maestria.levels = { gladimir: 5 };
    g.state.maestria.rollforward = { clicks: 0, charges: 2 };
    fireRollforward(g.state, content, g.emit);
    expect(g.state.counters).toMatchObject({ rollforwards: 1, tripleRollforwards: 0 });
    g.state.maestria.rollforward.charges = 3;
    fireRollforward(g.state, content, g.emit);
    expect(g.state.counters).toMatchObject({ rollforwards: 2, tripleRollforwards: 1 });
    g.state.maestria.rollforward.charges = 0;
    expect(fireRollforward(g.state, content, g.emit)).toBe(false);
    expect(g.state.counters.rollforwards).toBe(2);
  });

  it('counts the Festa de lançamento when it really fires', () => {
    const g = game();
    g.state.maestria.levels = { guto: 1 };
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    expect(startFesta(g.state, content, T0 + 2000, g.emit)).toBe(false);
    expect(g.state.counters.festas).toBe(0);
    const ready = T0 + 1000 + (content.maestrias.festa.rechargeMinutes[0] ?? 60) * 60_000;
    expect(startFesta(g.state, content, ready, g.emit)).toBe(true);
    expect(g.state.counters.festas).toBe(1);
  });

  it('counts a Super invasão won when the boss falls, and cleared only with every bug', () => {
    const play = (skipBugs: boolean) => {
      const g = game();
      g.state.maestria.levels = { wagner: 1 };
      advance(g.state, content, T0 + 1000, g.rng, g.emit);
      const now = T0 + 1000 + (content.maestrias.swarm.chargeMinutes[0] ?? 60) * 60_000;
      expect(startSwarm(g.state, content, now, g.emit)).toBe(true);
      let t = now;
      const cfg = content.maestrias.swarm;
      while (g.state.maestria.swarm.active && t < now + cfg.durationMs + 1000) {
        t += 250;
        updateSwarm(g.state, content, t, g.rng, g.emit);
        for (const bug of [...(g.state.maestria.swarm.active?.bugs ?? [])]) {
          if (skipBugs && !bug.boss) continue;
          for (let i = 0; i < bug.hp; i += 1) hitSwarmBug(g.state, content, bug.uid, t, g.emit);
        }
      }
      return g.state.counters;
    };
    expect(play(false)).toMatchObject({ swarmsWon: 1, swarmsCleared: 1 });
    expect(play(true)).toMatchObject({ swarmsWon: 1, swarmsCleared: 0 });
  });

  it('counts the free levels of the Design System, and only those', () => {
    const g = game();
    g.state.maestria.levels = { b2: 5 };
    const dear = content.disciplines.filter((def) => def.professor === 'pablo')[0]!;
    for (const def of content.disciplines) g.state.levels[def.id] = def.id === dear.id ? 5 : 3;
    buyDiscipline(g.state, content, dear.id, T0, g.emit, () => 0);
    const gift = g.events.find((e) => e.type === 'designSystem');
    expect(gift?.type === 'designSystem' ? gift.gifts.reduce((sum, entry) => sum + entry.levels, 0) : -1).toBeGreaterThan(0);
    expect(g.state.counters.designFreeLevels).toBe(gift?.type === 'designSystem' ? gift.gifts.reduce((sum, entry) => sum + entry.levels, 0) : -1);
  });

  it('counts Bolsa profit in seconds of production, never more than the market paid', () => {
    const g = game();
    g.state.maestria.levels = { pablo: 5 };
    g.state.levels[content.disciplines[0]!.id] = 100;
    g.state.coins = new Decimal('1e12');
    updateBolsa(g.state, content, T0, g.rng);
    const bolsa = g.state.maestria.bolsa;
    expect(buyAsset(g.state, content, 'gpu', 0.5, g.emit)).toBe(true);
    // A sale at a loss pays no profit and counts nothing.
    bolsa.assets.gpu!.price *= 0.5;
    sellAsset(g.state, content, 'gpu', 0.5, g.emit);
    expect(g.state.counters.bolsaProfitSeconds).toBe(0);
    // A sale at a profit counts the seconds taken out of the liquidity bucket.
    bolsa.assets.gpu!.price = 1.25;
    const liquidity = bolsa.liquidity;
    sellAsset(g.state, content, 'gpu', 1, g.emit);
    expect(g.state.counters.bolsaProfitSeconds).toBeGreaterThan(0);
    expect(g.state.counters.bolsaProfitSeconds).toBeCloseTo(liquidity - bolsa.liquidity, 6);
  });

  it('counts a graduation that was worth the diploma cap', () => {
    const g = game();
    g.state.runCoins = new Decimal('1e60');
    g.state.lifetimeCoins = new Decimal('1e60');
    expect(graduate(g.state, content, T0, g.emit)).toBe(true);
    expect(g.state.counters.cappedGraduations).toBe(1);
    const small = game();
    small.state.counters.graduations = 0;
    small.state.runCoins = new Decimal('8e20').mul(4);
    small.state.lifetimeCoins = small.state.runCoins;
    graduate(small.state, content, T0, small.emit);
    expect(small.state.counters.cappedGraduations).toBe(0);
  });
});

describe('conditions of the collection feats', () => {
  it('everyOwned asks for every scenery or theme, minus the exceptions', () => {
    const g = game();
    expect(met(g, { kind: 'everyOwned', of: 'sceneries' }).met).toBe(false);
    for (const scenery of content.sceneries) g.state.sceneries[scenery.id] = true;
    expect(met(g, { kind: 'everyOwned', of: 'sceneries' })).toEqual({ progress: 1, met: true });
    expect(met(g, { kind: 'everyOwned', of: 'themes', except: ['arco-iris'] }).met).toBe(false);
    for (const theme of content.themes) if (theme.id !== 'arco-iris') g.state.themes[theme.id] = true;
    expect(met(g, { kind: 'everyOwned', of: 'themes', except: ['arco-iris'] }).met).toBe(true);
    expect(met(g, { kind: 'everyOwned', of: 'themes' }).met).toBe(false);
  });

  it('everyAchievement ignores the achievement named, and Platina unlocks last', () => {
    const g = game();
    const others = content.achievements.filter((def) => def.id !== 'platinum');
    for (const def of others.slice(1)) g.state.achievements[def.id] = T0;
    expect(met(g, { kind: 'everyAchievement', except: ['platinum'] }).met).toBe(false);
    g.state.achievements[others[0]!.id] = T0;
    expect(met(g, { kind: 'everyAchievement', except: ['platinum'] }).met).toBe(true);
    const unlocked = checkAchievements(g.state, content, T0 + 1, () => {});
    expect(unlocked).toContain('platinum');
    expect(g.state.achievements.platinum).toBe(T0 + 1);
  });

  it('the Platina feat is out of the way of the 100 achievements, which count it too', () => {
    const g = game();
    for (const def of content.achievements.slice(0, 99)) g.state.achievements[def.id] = T0;
    expect(met(g, { kind: 'achievements', gte: 100 }).met).toBe(false);
    g.state.achievements.platinum = T0;
    expect(met(g, { kind: 'achievements', gte: 100 }).met).toBe(true);
  });

  it('prestigeComplete needs every node at its maximum', () => {
    const g = game();
    expect(met(g, { kind: 'prestigeComplete' }).met).toBe(false);
    for (const node of content.prestigeNodes) g.state.prestige[node.id] = node.maxLevel - 1;
    expect(met(g, { kind: 'prestigeComplete' }).met).toBe(false);
    for (const node of content.prestigeNodes) g.state.prestige[node.id] = node.maxLevel;
    expect(met(g, { kind: 'prestigeComplete' }).met).toBe(true);
  });

  it('releaseVersions follows the sprints of the run and horasBands the bar of the run', () => {
    const g = game();
    g.state.maestria.levels = { b1: 5, angelo: 5 };
    const per = content.maestrias.releases.sprintsPerVersion[4] ?? 3;
    g.state.run.sprintsCompleted = per * 9;
    expect(met(g, { kind: 'releaseVersions', gte: 10 }).met).toBe(false);
    g.state.run.sprintsCompleted = per * 10;
    expect(met(g, { kind: 'releaseVersions', gte: 10 }).met).toBe(true);

    const bands = content.maestrias.horas.bands[4] ?? 6;
    expect(met(g, { kind: 'horasBands', gte: bands }).met).toBe(false);
    // 30% of the bar per activity at most: spread the hours over four activities.
    const hours = (bands * content.maestrias.horas.hoursPerBand) / 4;
    g.state.maestria.horas = { clicks: hours, invasions: hours, sprints: hours, abilities: hours, levels: 0 };
    expect(met(g, { kind: 'horasBands', gte: bands }).met).toBe(true);
    // A lower Maestria cannot reach the top band count.
    g.state.maestria.levels.angelo = 1;
    expect(met(g, { kind: 'horasBands', gte: bands }).met).toBe(false);
  });

  it('bolsaPortfolio needs the four assets and the Fundo held together', () => {
    const g = game();
    g.state.maestria.levels = { pablo: 5 };
    g.state.levels[content.disciplines[0]!.id] = 100;
    updateBolsa(g.state, content, T0, g.rng);
    for (const asset of content.maestrias.bolsa.assets) expect(buyAsset(g.state, content, asset.id, 0.2, g.emit)).toBe(true);
    expect(met(g, { kind: 'bolsaPortfolio' }).met).toBe(false);
    expect(depositFund(g.state, content, 0.2, g.emit)).toBe(true);
    expect(met(g, { kind: 'bolsaPortfolio' })).toEqual({ progress: 1, met: true });
  });

  it('monitors count the hired ones, then the ones at the top level', () => {
    const g = game();
    for (const id of MONITOR_IDS) g.state.monitors.units[id].level = 1;
    expect(met(g, { kind: 'monitors', gte: 4 }).met).toBe(true);
    expect(met(g, { kind: 'monitors', gte: 4, maxed: true }).met).toBe(false);
    for (const def of content.monitors) g.state.monitors.units[def.id].level = def.levels.length;
    expect(met(g, { kind: 'monitors', gte: 4, maxed: true }).met).toBe(true);
  });

  it('every new feat explains what is missing', () => {
    const g = game();
    const ids = [
      'mythics-all', 'sceneries-all', 'themes-all', 'tree-complete', 'achievements-100', 'platinum', 'joinha-100', 'rollforward-50', 'rollforward-triple',
      'swarm-clear', 'swarm-25', 'festa-25', 'releases-10', 'horas-full', 'bolsa-hour', 'bolsa-portfolio', 'design-500', 'maestrias-doctorate',
      'monitors-all', 'monitors-max', 'mastery-all-cap', 'cap-reached',
    ];
    for (const id of ids) {
      const def = content.achievements.find((a) => a.id === id);
      expect(def, id).toBeDefined();
      const detail = achievementDetail(g.state, content, def!, createProbe(g.state, content));
      expect(detail.text, id).toMatch(/\S/);
      expect(detail.progress, id).not.toBeNull();
    }
  });
});
