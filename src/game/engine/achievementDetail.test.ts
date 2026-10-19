import { describe, expect, it } from 'vitest';
import { content as realContent } from '../content';
import type { Condition } from '../content/types';
import { achievementDetail } from './achievementDetail';
import { createProbe } from './achievements';
import { Decimal } from './decimal';
import { createInitialState } from './init';
import { achievementViews } from './views';
import { newGame, T0 } from './__fixtures__/helpers';

/** One-achievement content, so each test reads the detail of a single condition. */
function detailOf(condition: Condition, setup?: (g: ReturnType<typeof newGame>) => void) {
  const g = newGame((c) => {
    c.achievements = [{ id: 'x', family: 'click', name: 'x', emoji: 'x', description: 'x', condition }];
  });
  setup?.(g);
  return achievementDetail(g.state, g.content, g.content.achievements[0]!, createProbe(g.state, g.content));
}

describe('achievement detail', () => {
  it('counters read "current / target unit"', () => {
    const d = detailOf({ kind: 'counter', counter: 'clicks', gte: 5000 }, (g) => (g.state.counters.clicks = 3214));
    expect(d.text).toBe('3.214 / 5.000 cliques');
    expect(d.progress).toBeCloseTo(3214 / 5000);
  });

  it('coins read as formatted numbers', () => {
    const d = detailOf({ kind: 'lifetimeCoins', gte: '1000' }, (g) => (g.state.lifetimeCoins = new Decimal(250)));
    expect(d.text).toBe('250 / 1.000 moedas');
  });

  it('professorsHired names who is still missing', () => {
    const d = detailOf({ kind: 'professorsHired', gte: 3 });
    expect(d.text).toBe('1 de 3 professores');
    expect(d.note).toMatch(/^Ainda sem contratar: /);
  });

  it('allResearch lists the research still missing', () => {
    const d = detailOf({ kind: 'allResearch', professor: 'gladimir' });
    expect(d.text).toMatch(/^0 de \d+ pesquisas$/);
    expect(d.note).toMatch(/^Pesquisas de .* que faltam: /);
  });

  it('lastRun shows how far the run was from the limit, with a real fraction', () => {
    const none = detailOf({ kind: 'lastRun', metric: 'seconds', lte: 600 });
    expect(none.progress).toBe(0);
    const d = detailOf({ kind: 'lastRun', metric: 'seconds', lte: 600 }, (g) => {
      g.state.lastRun = { seconds: 1200, clicks: 0, investedProfessors: 1, clickShare: 0, sprintsCompleted: 0, sprintsFailed: 0, eventsDefended: 0, eventsMissed: 0 };
    });
    expect(d.progress).toBeCloseTo(0.5);
    expect(d.text).toBe('última turma: 20 min (limite 10 min)');
    expect(d.note).toBe('Faltou baixar 10 min na próxima formatura.');
  });

  it('lastRunClean counts the four parts', () => {
    const d = detailOf({ kind: 'lastRunClean' }, (g) => {
      g.state.lastRun = { seconds: 1, clicks: 0, investedProfessors: 1, clickShare: 0, sprintsCompleted: 1, sprintsFailed: 1, eventsDefended: 1, eventsMissed: 0 };
    });
    expect(d.progress).toBeCloseTo(0.75);
    expect(d.note).toContain('nenhum sprint perdido');
  });

  it('lastRunClickShare is a fraction of the target share', () => {
    const d = detailOf({ kind: 'lastRunClickShare', gte: 0.8 }, (g) => {
      g.state.lastRun = { seconds: 1, clicks: 0, investedProfessors: 1, clickShare: 0.4, sprintsCompleted: 0, sprintsFailed: 0, eventsDefended: 0, eventsMissed: 0 };
    });
    expect(d.progress).toBeCloseTo(0.5);
  });

  it('a locked secret reveals nothing and an unlocked one is not a bar', () => {
    const g = newGame();
    const secret = g.content.achievements.find((def) => def.id === 'a-secret')!;
    expect(achievementDetail(g.state, g.content, secret, createProbe(g.state, g.content))).toEqual({ progress: null, text: null, note: null });
    g.state.achievements['a-clicks'] = T0;
    const view = achievementViews(g.state, g.content).find((v) => v.id === 'a-clicks')!;
    expect(view).toMatchObject({ unlocked: true, progress: 1, text: null });
  });

  it('every real non-secret achievement has finite progress and a label, secrets none', () => {
    const state = createInitialState(realContent, T0);
    const views = achievementViews(state, realContent);
    expect(views).toHaveLength(realContent.achievements.length);
    for (const def of realContent.achievements) {
      const view = views.find((v) => v.id === def.id)!;
      if (def.condition.kind === 'secret' || def.secret) {
        expect(view.text).toBeNull();
        expect(view.progress).toBeNull();
      } else {
        expect(view.text, def.id).toBeTruthy();
        expect(Number.isFinite(view.progress), def.id).toBe(true);
      }
    }
  });
});
