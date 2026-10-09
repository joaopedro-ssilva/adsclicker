import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { PROFESSOR_IDS } from '../content/types';
import type { ProfessorId } from '../content/types';
import { activateAbility, buyDiscipline, click, graduate } from './actions';
import { checkAchievements } from './achievements';
import { Decimal } from './decimal';
import { milestoneMultAt, milestoneMultiplier, nextMilestone } from './formulas';
import { createInitialState } from './init';
import { masteryLevels, masteryRank, masteryView } from './mastery';
import { deserializeState, serializeState } from './save';
import { countSession, localDay, markActive, startSession, touchCalendar, SESSION_IDLE_MS } from './session';
import type { GameState } from './state';
import { computeStats } from './stats';
import { advance } from './tick';
import { levelledView } from './views';
import { createRng } from './rng';
import type { Emit, GameEvent } from '../store/types';

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

function game() {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  return { state: createInitialState(content, T0), events, emit, rng: createRng(11) };
}

/** Puts `total` levels over the three disciplines of a professor and hires them. */
function setLevels(state: GameState, professor: ProfessorId, total: number): void {
  state.hired[professor] = true;
  const defs = content.disciplines.filter((def) => def.professor === professor);
  const each = Math.floor(total / defs.length);
  defs.forEach((def, i) => {
    state.levels[def.id] = each + (i === 0 ? total - each * defs.length : 0);
  });
}

describe('milestones', () => {
  it('multiply x2 up to 100, then x3, x3 and x4, and x2 again past 400', () => {
    const { balance } = content;
    const at = (level: number) => milestoneMultiplier(level, balance).toNumber();
    expect(at(9)).toBe(1);
    expect(at(10)).toBe(2);
    expect(at(100)).toBe(16);
    expect(at(199)).toBe(16);
    expect(at(200)).toBe(48);
    expect(at(300)).toBe(144);
    expect(at(400)).toBe(576);
    expect(at(500)).toBe(1152);
    expect(milestoneMultAt(200, balance)).toBe(3);
    expect(milestoneMultAt(400, balance)).toBe(4);
    expect(milestoneMultAt(500, balance)).toBe(2);
  });

  it('shows the multiplier of the next milestone in the card view', () => {
    const g = game();
    g.state.levels['cafe-quentinho'] = 199;
    const id = content.disciplines[0]!.id;
    g.state.levels[id] = 199;
    const view = levelledView(g.state, content, id);
    expect(view?.nextMilestone).toBe(nextMilestone(199, content.balance));
    expect(view?.nextMilestone).toBe(200);
    expect(view?.nextMilestoneMult).toBe(3);
  });
});

describe('Domínio', () => {
  it('is one rank per 25 levels summed over the disciplines, capped', () => {
    const g = game();
    setLevels(g.state, 'edecio', 24);
    expect(masteryRank(g.state, content, 'edecio')).toBe(0);
    setLevels(g.state, 'edecio', 25);
    expect(masteryRank(g.state, content, 'edecio')).toBe(1);
    setLevels(g.state, 'edecio', 260);
    expect(masteryLevels(g.state, content, 'edecio')).toBe(260);
    expect(masteryRank(g.state, content, 'edecio')).toBe(10);
    setLevels(g.state, 'edecio', 5000);
    expect(masteryRank(g.state, content, 'edecio')).toBe(content.balance.mastery.cap);
  });

  it('reports rank, progress to the next and a line with the numbers filled in', () => {
    const g = game();
    setLevels(g.state, 'edecio', 60); // rank 2, 10 of 25 towards 3
    const view = masteryView(g.state, content, 'edecio');
    expect(view).toMatchObject({ rank: 2, cap: 40, maxed: false, levels: 60, nextAt: 75 });
    expect(view.progress).toBeCloseTo(0.4, 5);
    expect(view.line).toBe('Cada clique rende a mais 0,3% do que a turma inteira produz por segundo');
    setLevels(g.state, 'gladimir', 1000);
    expect(masteryView(g.state, content, 'gladimir').line).toBe('Offline: conta até 6 h a mais de ausência e paga 20% a mais da produção');
  });

  it('pays each professor mechanic at the cap, to the whole game', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) setLevels(g.state, id, 1000);
    const base = createInitialState(content, T0);
    for (const id of PROFESSOR_IDS) base.hired[id] = true;
    const s = computeStats(g.state, content);
    const b = computeStats(base, content);

    expect(s.clickFromIdle - b.clickFromIdle).toBeCloseTo(0.06, 6);
    expect(s.offlineHours - b.offlineHours).toBeCloseTo(6, 6);
    expect(s.offlineRate - b.offlineRate).toBeCloseTo(0.2, 6);
    expect(s.costMult / b.costMult).toBeCloseTo(0.99 ** 40, 6);
    expect(s.eventReward - b.eventReward).toBeCloseTo(1, 6);
    expect(s.abilityDuration - b.abilityDuration).toBeCloseTo(0.4, 6);
    expect(s.abilityCooldown / b.abilityCooldown).toBeCloseTo(0.99 ** 40, 6);
    expect(s.sprintReward - b.sprintReward).toBeCloseTo(1, 6);
    expect(s.diplomaGain - b.diplomaGain).toBeCloseTo(0.2, 6);
    expect(s.globalPower / b.globalPower).toBeCloseTo(1.0075 ** 40, 6);
  });

  it('counts only while the professor is hired', () => {
    const g = game();
    setLevels(g.state, 'pablo', 1000);
    g.state.hired.pablo = false;
    expect(computeStats(g.state, content).globalPower).toBe(computeStats(createInitialState(content, T0), content).globalPower);
  });
});

describe('honoured professor', () => {
  function readyToGraduate() {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    g.state.runCoins = new Decimal('3.2e21'); // sqrt(4) = 2 diplomas
    g.state.lifetimeCoins = g.state.runCoins;
    return g;
  }

  it('graduating with a pick honours that professor and remembers it', () => {
    const g = readyToGraduate();
    expect(graduate(g.state, content, T0, g.emit, 'wagner')).toBe(true);
    expect(g.state.honoured).toBe('wagner');
    expect(g.state.honouredBefore).toEqual({ wagner: true });
    expect(g.state.hired.wagner).toBe(false); // the run restarted
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    g.state.runCoins = new Decimal('3.2e21');
    expect(graduate(g.state, content, T0, g.emit)).toBe(true);
    expect(g.state.honoured).toBeNull(); // the pick is optional and does not carry over
    expect(g.state.honouredBefore).toEqual({ wagner: true });
  });

  it('ignores a professor who is not hired', () => {
    const g = readyToGraduate();
    g.state.hired.pablo = false;
    graduate(g.state, content, T0, g.emit, 'pablo');
    expect(g.state.honoured).toBeNull();
    expect(g.state.honouredBefore).toEqual({});
  });

  it('boosts the mechanic during the next run', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    const plain = computeStats(g.state, content);
    const check = (id: ProfessorId, pick: (s: ReturnType<typeof computeStats>) => number, expected: number) => {
      g.state.honoured = id;
      expect(pick(computeStats(g.state, content)) / pick(plain), id).toBeCloseTo(expected, 6);
    };
    check('wagner', (s) => s.eventInterval, 0.5);
    check('guto', (s) => s.abilityCooldown, 0.6);
    check('b1', (s) => s.sprintReward, 2);
    check('angelo', (s) => s.diplomaGain, 1.25);
    g.state.honoured = 'gladimir';
    expect(computeStats(g.state, content).offlineRate).toBe(1);
    check('wagner', (s) => s.eventReward, 1.25);
    check('gladimir', (s) => s.offlineHours - plain.offlineHours + 1, 5);
    check('edecio', (s) => s.comboMax, 2);
  });

  it('doubles the Domínio bonus of B2 and adds half of Pablo\'s again', () => {
    const g = game();
    setLevels(g.state, 'b2', 500); // rank 20
    setLevels(g.state, 'pablo', 500);
    const plain = computeStats(g.state, content);
    g.state.honoured = 'b2';
    expect(computeStats(g.state, content).costMult / plain.costMult).toBeCloseTo(0.99 ** 20, 6);
    g.state.honoured = 'pablo';
    expect(computeStats(g.state, content).globalPower / plain.globalPower).toBeCloseTo(1.00375 ** 20, 6);
  });

  it('does not boost a professor who is no longer hired', () => {
    const g = game();
    g.state.honoured = 'wagner';
    expect(computeStats(g.state, content).eventInterval).toBe(1);
  });

  it('still lets the combo fall for the honoured Edécio: the honour raises the limit, it does not freeze it', () => {
    const g = game();
    g.state.honoured = 'edecio';
    g.state.combo = { steps: 12, lastClickAt: T0 };
    advance(g.state, content, T0 + 60_000, g.rng, g.emit);
    expect(g.state.combo.steps).toBe(0);
  });

  it('pays 25% more diplomas to the honoured Angelo at the end of the run', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    g.state.honoured = 'angelo';
    g.state.counters.graduations = 3; // the cap of the first graduations (10, 13, 16) would hold the 12.5 back
    g.state.runCoins = new Decimal('8e22'); // sqrt(100) = 10 -> 12.5
    g.state.lifetimeCoins = g.state.runCoins;
    graduate(g.state, content, T0, g.emit);
    expect(g.state.diplomas).toBe(12);
  });
});

describe('save', () => {
  it('round-trips the run, honour, session and calendar', () => {
    const g = game();
    g.state.run.clicks = 12;
    g.state.run.clickCoins = new Decimal('1.5e9');
    g.state.honoured = 'guto';
    g.state.honouredBefore = { guto: true, b1: true };
    g.state.abilitiesTried = { 'auto-scaling': true };
    g.state.calendar = { day: 19000, streak: 3, gradDay: 19000, gradsToday: 2 };
    g.state.lastRun = { seconds: 90, clicks: 0, investedProfessors: 2, clickShare: 0.5, sprintsCompleted: 1, sprintsFailed: 0, eventsDefended: 2, eventsMissed: 0 };
    const back = deserializeState(serializeState(g.state), content, T0)!;
    expect(back.run.clicks).toBe(12);
    expect(back.run.clickCoins.toString()).toBe(g.state.run.clickCoins.toString());
    expect(back.honoured).toBe('guto');
    expect(back.honouredBefore).toEqual({ guto: true, b1: true });
    expect(back.abilitiesTried).toEqual({ 'auto-scaling': true });
    expect(back.calendar).toEqual(g.state.calendar);
    expect(back.lastRun).toEqual(g.state.lastRun);
  });

  it('loads an old save that has none of the new fields', () => {
    const g = game();
    g.state.levels[content.disciplines[0]!.id] = 30;
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    for (const key of ['run', 'lastRun', 'honoured', 'honouredBefore', 'abilitiesTried', 'session', 'calendar']) delete raw[key];
    delete (raw.counters as Record<string, unknown>).biggestPurchase;
    delete (raw.counters as Record<string, unknown>).bestDayStreak;
    const back = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(back.levels[content.disciplines[0]!.id]).toBe(30);
    expect(back.run.clicks).toBe(0);
    expect(back.lastRun).toBeNull();
    expect(back.honoured).toBeNull();
    expect(back.honouredBefore).toEqual({});
    expect(back.calendar.streak).toBe(0);
    expect(back.counters.biggestPurchase).toBe(0);
  });

  it('drops an honoured professor that does not exist', () => {
    const g = game();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    raw.honoured = 'nobody';
    raw.honouredBefore = { nobody: true, pablo: true };
    const back = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(back.honoured).toBeNull();
    expect(back.honouredBefore).toEqual({ pablo: true });
  });
});

describe('run, session and calendar', () => {
  it('counts the run: clicks, click coins, levels bought; a graduation closes it', () => {
    const g = game();
    click(g.state, content, T0, g.rng, g.emit);
    click(g.state, content, T0 + 100, g.rng, g.emit);
    expect(g.state.run.clicks).toBe(2);
    expect(g.state.run.clickCoins.gt(0)).toBe(true);
    expect(g.state.run.clickCoins.toString()).toBe(g.state.runCoins.toString());

    g.state.coins = new Decimal('1e6');
    expect(buyDiscipline(g.state, content, content.disciplines[0]!.id, T0 + 200, g.emit)).toBe(true);
    expect(g.state.run.levelsBought).toBe(1);
    expect(g.state.counters.biggestPurchase).toBe(1);

    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    g.state.runCoins = new Decimal('8e20');
    graduate(g.state, content, T0 + 300, g.emit);
    expect(g.state.run.clicks).toBe(0);
    expect(g.state.run.levelsBought).toBe(0);
    expect(g.state.lastRun?.clicks).toBe(2);
    expect(g.state.lastRun?.investedProfessors).toBe(1);
    expect(g.state.lastRun?.clickShare).toBeGreaterThan(0);
  });

  it('counts the sitting only while the player acts', () => {
    const g = game();
    startSession(g.state, T0);
    g.state.lastTickAt = T0;
    markActive(g.state, T0);
    advance(g.state, content, T0 + 60_000, g.rng, g.emit);
    expect(g.state.session.seconds).toBeCloseTo(60, 5);
    // Untouched for longer than the idle window: the clock stops.
    advance(g.state, content, T0 + 60_000 + SESSION_IDLE_MS + 60_000, g.rng, g.emit);
    expect(g.state.session.seconds).toBeLessThan(60 + 60);
    const frozen = g.state.session.seconds;
    advance(g.state, content, T0 + 60_000 + SESSION_IDLE_MS + 120_000, g.rng, g.emit);
    expect(g.state.session.seconds).toBe(frozen);
    countSession(g.state, 10, T0 + 1_000_000);
    expect(g.state.session.seconds).toBe(frozen);
  });

  it('tracks consecutive days played', () => {
    const g = game();
    touchCalendar(g.state, T0);
    expect(g.state.calendar.streak).toBe(1);
    touchCalendar(g.state, T0 + 3_600_000);
    expect(g.state.calendar.streak).toBe(1);
    for (let d = 1; d <= 6; d += 1) touchCalendar(g.state, T0 + d * DAY);
    expect(g.state.calendar.streak).toBe(7);
    expect(g.state.counters.bestDayStreak).toBe(7);
    touchCalendar(g.state, T0 + 9 * DAY);
    expect(g.state.calendar.streak).toBe(1);
    expect(g.state.counters.bestDayStreak).toBe(7);
    expect(localDay(T0 + DAY)).toBe(localDay(T0) + 1);
  });
});

describe('new achievement conditions (real content)', () => {
  const unlocked = (g: ReturnType<typeof game>) => checkAchievements(g.state, content, T0 + 5_000, g.emit);

  it('Mateada: an hour of play in one sitting', () => {
    const g = game();
    g.state.session.seconds = 3599;
    expect(unlocked(g)).not.toContain('session-1h');
    g.state.session.seconds = 3600;
    expect(unlocked(g)).toContain('session-1h');
    expect(g.state.skins['edecio-gauchao']).toBe(true);
  });

  it('Um Milhão de Joinhas and Compra Coletiva read their counters', () => {
    const g = game();
    g.state.counters.clicks = 999_999;
    g.state.counters.biggestPurchase = 99;
    expect(unlocked(g)).not.toEqual(expect.arrayContaining(['click-1m', 'bulk-100']));
    g.state.counters.clicks = 1_000_000;
    g.state.counters.biggestPurchase = 100;
    expect(unlocked(g)).toEqual(expect.arrayContaining(['click-1m', 'bulk-100']));
  });

  it('Índice Criado: 500 levels bought in one run', () => {
    const g = game();
    g.state.run.levelsBought = 499;
    expect(unlocked(g)).not.toContain('levels-run-500');
    g.state.run.levelsBought = 500;
    expect(unlocked(g)).toContain('levels-run-500');
  });

  it('Alinhada: every discipline of one professor at the same level, 50 or more', () => {
    const g = game();
    const defs = content.disciplines.filter((def) => def.professor === 'edecio');
    defs.forEach((def) => (g.state.levels[def.id] = 60));
    g.state.levels[defs[1]!.id] = 61;
    expect(unlocked(g)).not.toContain('aligned-50');
    defs.forEach((def) => (g.state.levels[def.id] = 49));
    expect(unlocked(g)).not.toContain('aligned-50');
    defs.forEach((def) => (g.state.levels[def.id] = 50));
    expect(unlocked(g)).toContain('aligned-50');
  });

  it('Nada se Perde and Corpo Docente read the Domínio', () => {
    const g = game();
    setLevels(g.state, 'gladimir', 999);
    expect(unlocked(g)).not.toContain('mastery-gladimir');
    setLevels(g.state, 'gladimir', 1000);
    expect(unlocked(g)).toContain('mastery-gladimir');
    expect(g.state.skins['gladimir-arquivista']).toBe(true);

    for (const id of PROFESSOR_IDS) setLevels(g.state, id, 249);
    expect(unlocked(g)).not.toContain('mastery-all-10');
    setLevels(g.state, 'pablo', 250);
    for (const id of PROFESSOR_IDS) setLevels(g.state, id, 250);
    expect(unlocked(g)).toContain('mastery-all-10');
  });

  it('Legado: 500 levels over the Edécio disciplines', () => {
    const g = game();
    setLevels(g.state, 'edecio', 499);
    expect(unlocked(g)).not.toContain('legado-edecio');
    setLevels(g.state, 'edecio', 500);
    expect(unlocked(g)).toContain('legado-edecio');
  });

  it('Primeira Rodada and Tudo no Ar use every ability', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    for (const research of content.research) g.state.research[research.id] = true;
    const now = T0 + 1_000;
    for (const ability of content.abilities.slice(0, -1)) activateAbility(g.state, content, ability.id, now, g.emit);
    expect(g.state.achievements['abilities-tried']).toBeUndefined();
    expect(g.state.achievements['abilities-active']).toBeUndefined();
    const last = content.abilities.at(-1)!;
    activateAbility(g.state, content, last.id, now + 2_000, g.emit);
    expect(g.state.achievements['abilities-tried']).toBeDefined();
    expect(g.state.achievements['abilities-active']).toBeDefined();
    expect(g.state.skins['guto-paladino']).toBe(true);
    expect(g.state.skins['guto-capitao']).toBe(true);
  });

  it('Tudo no Ar needs them running together, not only used', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
    for (const research of content.research) g.state.research[research.id] = true;
    for (const ability of content.abilities) activateAbility(g.state, content, ability.id, T0, g.emit);
    g.state.achievements = {};
    g.state.buffs = g.state.buffs.slice(1);
    const now = unlocked(g);
    expect(now).not.toContain('abilities-active');
    expect(now).toContain('abilities-tried');
  });

  it('P = NP: every research bought in the run', () => {
    const g = game();
    for (const research of content.research.slice(1)) g.state.research[research.id] = true;
    expect(unlocked(g)).not.toContain('research-all');
    g.state.research[content.research[0]!.id] = true;
    expect(unlocked(g)).toContain('research-all');
  });

  it('Colecionador de Raras: every rare skin owned', () => {
    const g = game();
    const rares = content.skins.filter((skin) => skin.rarity === 'rare');
    for (const skin of rares.slice(1)) g.state.skins[skin.id] = true;
    expect(unlocked(g)).not.toContain('rares-all');
    g.state.skins[rares[0]!.id] = true;
    expect(unlocked(g)).toContain('rares-all');
  });

  it('Volta Olímpica: each of the 8 professors honoured', () => {
    const g = game();
    g.state.honouredBefore = Object.fromEntries(PROFESSOR_IDS.slice(1).map((id) => [id, true]));
    expect(unlocked(g)).not.toContain('honour-all');
    g.state.honouredBefore.edecio = true;
    expect(unlocked(g)).toContain('honour-all');
  });

  it('Sequência de Sete reads the best streak of days', () => {
    const g = game();
    g.state.counters.bestDayStreak = 6;
    expect(unlocked(g)).not.toContain('days-7');
    g.state.counters.bestDayStreak = 7;
    expect(unlocked(g)).toContain('days-7');
  });

  describe('judging the run closed by a graduation', () => {
    function graduated(prepare: (g: ReturnType<typeof game>) => void, now = T0) {
      const g = game();
      for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
      prepare(g);
      g.state.runCoins = new Decimal('8e20');
      g.state.lifetimeCoins = g.state.runCoins;
      graduate(g.state, content, now, g.emit);
      return g;
    }

    it('Sem Mouse and O(1): zero clicks, under 10 minutes', () => {
      const quick = graduated((g) => (g.state.run.seconds = 599));
      expect(quick.state.achievements['grad-fast']).toBeDefined();
      expect(quick.state.achievements['grad-no-mouse']).toBeDefined();
      expect(quick.state.skins['pablo-singularidade']).toBe(true);

      const slow = graduated((g) => {
        g.state.run.seconds = 601;
        g.state.run.clicks = 1;
      });
      expect(slow.state.achievements['grad-fast']).toBeUndefined();
      expect(slow.state.achievements['grad-no-mouse']).toBeUndefined();
    });

    it('Turma Enxuta: at most 3 professors with levels', () => {
      const lean = graduated((g) => {
        setLevels(g.state, 'edecio', 30);
        setLevels(g.state, 'gladimir', 30);
        setLevels(g.state, 'b2', 30);
      });
      expect(lean.state.achievements['grad-lean']).toBeDefined();
      const wide = graduated((g) => {
        for (const id of ['edecio', 'gladimir', 'b2', 'wagner'] as const) setLevels(g.state, id, 30);
      });
      expect(wide.state.achievements['grad-lean']).toBeUndefined();
    });

    it('Só no Clique: 70% of the coins from clicks', () => {
      const clicky = graduated((g) => (g.state.run.clickCoins = new Decimal('5.6e20')));
      expect(clicky.state.achievements['grad-click-share']).toBeDefined();
      const idle = graduated((g) => (g.state.run.clickCoins = new Decimal('5.2e20')));
      expect(idle.state.achievements['grad-click-share']).toBeUndefined();
    });

    it('Semestre Perfeito: nothing failed or missed, and one of each done', () => {
      const clean = graduated((g) => {
        g.state.run.sprintsCompleted = 1;
        g.state.run.eventsDefended = 1;
      });
      expect(clean.state.achievements['grad-perfect']).toBeDefined();
      for (const dirty of [
        { sprintsFailed: 1 },
        { eventsMissed: 1 },
        { sprintsCompleted: 0 },
        { eventsDefended: 0 },
      ]) {
        const g = graduated((x) => Object.assign(x.state.run, { sprintsCompleted: 1, eventsDefended: 1 }, dirty));
        expect(g.state.achievements['grad-perfect'], JSON.stringify(dirty)).toBeUndefined();
      }
    });

    it('Set Fechado: 6 graduations on the same day', () => {
      const g = game();
      for (let i = 0; i < 6; i += 1) {
        for (const id of PROFESSOR_IDS) g.state.hired[id] = true;
        g.state.runCoins = new Decimal('8e20');
        g.state.lifetimeCoins = g.state.runCoins;
        expect(g.state.achievements['grad-day-6']).toBeUndefined();
        graduate(g.state, content, T0 + i * 60_000, g.emit);
      }
      expect(g.state.achievements['grad-day-6']).toBeDefined();
      expect(g.state.skins['angelo-capitao']).toBe(true);

      const h = game();
      for (let i = 0; i < 6; i += 1) {
        for (const id of PROFESSOR_IDS) h.state.hired[id] = true;
        h.state.runCoins = new Decimal('8e20');
        h.state.lifetimeCoins = h.state.runCoins;
        graduate(h.state, content, T0 + i * DAY, h.emit);
      }
      expect(h.state.achievements['grad-day-6']).toBeUndefined();
    });
  });
});
