import { describe, expect, it } from 'vitest';
import { activateAbility } from './actions';
import { startBuff } from './buffs';
import { click } from './click';
import { computeStats } from './stats';
import { advance } from './tick';
import { abilityViews } from './views';
import { eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

describe('abilities', () => {
  it('is available as soon as its professor is hired', () => {
    const g = newCleanGame();
    expect(activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit)).toBe(false);
    hire(g.state, 'guto');
    expect(activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit)).toBe(true);
  });

  it('applies the buff, starts the cooldown and reports it', () => {
    const g = newCleanGame();
    hire(g.state, 'guto');
    activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit);
    expect(g.state.buffs).toHaveLength(1);
    expect(g.state.buffs[0]).toMatchObject({ id: 'buff-scale', source: 'ability', startedAt: T0, endsAt: T0 + 30_000 });
    expect(g.state.abilityReadyAt['auto-scaling']).toBe(T0 + 600_000);
    expect(g.state.counters.abilitiesUsed).toBe(1);
    expect(g.events.map((e) => e.type)).toEqual(['abilityUsed', 'buffStart']);
    expect(computeStats(g.state, g.content).idlePower).toBe(5);
  });

  it('refuses while cooling down and works again afterwards', () => {
    const g = newCleanGame();
    hire(g.state, 'guto');
    activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit);
    expect(activateAbility(g.state, g.content, 'auto-scaling', T0 + 599_999, g.emit)).toBe(false);
    expect(g.state.counters.abilitiesUsed).toBe(1);
    expect(activateAbility(g.state, g.content, 'auto-scaling', T0 + 600_000, g.emit)).toBe(true);
    expect(g.state.counters.abilitiesUsed).toBe(2);
  });

  it('multiplies production only while the buff lasts', () => {
    const g = newCleanGame();
    hire(g.state, 'guto');
    g.state.levels['cafe'] = 10; // 30/s
    activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit);
    advance(g.state, g.content, T0 + 40_000, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(30 * 5 * 30 + 10 * 30, 4);
    expect(g.state.buffs).toHaveLength(0);
  });

  it('is unlocked by research when the content says so', () => {
    const g = newCleanGame();
    hire(g.state, 'guto');
    expect(activateAbility(g.state, g.content, 'aula-show', T0, g.emit)).toBe(false);
    g.state.research['r-aula'] = true;
    expect(activateAbility(g.state, g.content, 'aula-show', T0, g.emit)).toBe(true);
  });

  it('stays locked when only the hired professor would unlock it but a research is required', () => {
    const g = newCleanGame();
    expect(abilityViews(g.state, g.content).find((a) => a.id === 'aula-show')?.unlocked).toBe(false);
  });

  it('boosts clicks through the clickPower buff', () => {
    const g = newCleanGame();
    g.state.research['r-aula'] = true;
    activateAbility(g.state, g.content, 'aula-show', T0, g.emit);
    click(g.state, g.content, T0, () => 0.99, g.emit);
    expect(num(g.state.coins)).toBe(10);
  });

  it('scales duration and cooldown with abilityDuration and abilityCooldown', () => {
    const g = newCleanGame((c) => {
      c.research.push({
        id: 'tune',
        professor: 'guto',
        name: 'x',
        emoji: 'x',
        description: 'x',
        cost: '1',
        effects: [
          { stat: 'abilityDuration', op: 'mult', value: 2 },
          { stat: 'abilityCooldown', op: 'mult', value: 0.5 },
        ],
        requires: [],
      });
    });
    hire(g.state, 'guto');
    g.state.research['tune'] = true;
    activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit);
    expect(g.state.buffs[0]!.endsAt).toBe(T0 + 60_000);
    expect(g.state.abilityReadyAt['auto-scaling']).toBe(T0 + 300_000);
  });

  it('refreshes the timer when the same buff starts again', () => {
    const g = newCleanGame();
    const buff = g.content.abilities[0]!.buff;
    const stats = computeStats(g.state, g.content);
    startBuff(g.state, buff, 'ability', stats, T0, g.emit);
    startBuff(g.state, buff, 'ability', stats, T0 + 10_000, g.emit);
    expect(g.state.buffs).toHaveLength(1);
    expect(g.state.buffs[0]!.endsAt).toBe(T0 + 40_000);
    expect(eventsOf(g.events, 'buffStart')).toHaveLength(2);
  });

  it('shows cooldown and active time in the views', () => {
    const g = newCleanGame();
    hire(g.state, 'guto');
    activateAbility(g.state, g.content, 'auto-scaling', T0, g.emit);
    const view = abilityViews(g.state, g.content, T0 + 10_000).find((a) => a.id === 'auto-scaling')!;
    expect(view).toMatchObject({ unlocked: true, cooldownLeftMs: 590_000, cooldownMs: 600_000, activeLeftMs: 20_000 });
  });
});
