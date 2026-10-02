import { describe, expect, it } from 'vitest';
import { createRun, simulateRun, stepRun } from './index';
import type { FightEvent, Run, RunAction, RunSetup } from './index';
import { fixtureContent as content, setupOf, studentBuild } from './__fixtures__/content';

const BIG_HP = 100000;
/** A player who survives and deals 1 damage: fights last long and nothing dies by surprise. */
const slow = () => studentBuild({ logica: 1, foco: BIG_HP });

/** Steps until `done` (default: the run ended), picking option 0 when choosing. */
function play(setup: RunSetup, schedule: RunAction[] = [], done: (run: Run) => boolean = () => false, maxSteps = 30000) {
  const run = createRun(setup, content);
  const events: FightEvent[] = [];
  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost' || done(run)) break;
    const extra: RunAction[] = run.state.phase === 'choosing' ? [{ tick: run.state.tick, kind: 'choice', option: 0 }] : [];
    events.push(...stepRun(run, [...schedule, ...extra], content));
  }
  return { run, events };
}

const of = <T extends FightEvent['type']>(events: FightEvent[], type: T) =>
  events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);

describe('determinism', () => {
  const setup = setupOf([['grunt'], ['stunner', 'grunt'], ['charger'], ['boss']], studentBuild({ atencao: 30 }, ['strike']), { seed: 777 });
  const actions: RunAction[] = [
    { tick: 5, kind: 'flow' },
    { tick: 60, kind: 'skill', skill: 'strike' },
  ];

  it('gives the same outcome twice', () => {
    expect(simulateRun(setup, actions, content)).toEqual(simulateRun(setup, actions, content));
  });

  it('simulateRun equals createRun plus stepRun', () => {
    const { run, events } = play(setup, actions);
    const outcome = simulateRun(setup, actions, content);
    const end = of(events, 'end')[0];
    expect(outcome.won).toBe(run.state.phase === 'won');
    expect(outcome.ticks).toBe(run.state.tick);
    expect(outcome.hpLeft).toBe(run.state.player.hp);
    expect(outcome.reason).toBe(end?.reason);
    expect(outcome.wavesCleared).toBe(of(events, 'waveCleared').length);
  });

  it('keeps a golden outcome for a fixed seed', () => {
    expect(simulateRun(setup, actions, content)).toMatchInlineSnapshot(`
      {
        "hpLeft": 0,
        "reason": "defeated",
        "ticks": 231,
        "wavesCleared": 3,
        "won": false,
      }
    `);
  });

  it('does not let Flow shift later crit rolls', () => {
    const build = studentBuild({ atencao: 50, logica: 1, foco: BIG_HP });
    const base = of(play(setupOf([['grunt']], build), [], (r) => r.state.tick >= 400).events, 'playerHit').map((h) => h.crit);
    const withFlow = of(play(setupOf([['grunt']], build), [{ tick: 0, kind: 'flow' }], (r) => r.state.tick >= 400).events, 'playerHit').map((h) => h.crit);
    expect(withFlow[0]).toBe(true);
    expect(withFlow.slice(1)).toEqual(base.slice(1, withFlow.length));
    expect(base.length).toBeGreaterThan(10);
  });

  it('replaces state with a fresh object and never mutates the old one', () => {
    const run = createRun(setupOf([['grunt']], slow()), content);
    const before = run.state;
    const snapshot = JSON.stringify(before);
    stepRun(run, [], content);
    expect(run.state).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(run.state.tick).toBe(1);
  });
});

describe('termination', () => {
  it('ends in timeout when nothing can finish the fight', () => {
    const build = studentBuild({ logica: 1, foco: 1000000, resiliencia: 100000 });
    const hugeEnemy = { ...content.enemies[0]!, id: 'wall', hp: 1e9 };
    const wall = { ...content, enemies: [...content.enemies, hugeEnemy] };
    const outcome = simulateRun(setupOf([['wall']], build), [], wall);
    expect(outcome).toMatchObject({ won: false, reason: 'timeout', ticks: 18000 });
  });

  it('handles a stage without waves', () => {
    expect(simulateRun(setupOf([]), [], content)).toMatchObject({ won: true, reason: 'cleared', wavesCleared: 0 });
  });
});

describe('enemy traits', () => {
  it('stun: every second attack takes away the next hit', () => {
    const { events } = play(setupOf([['stunner']], slow()), [], (r) => r.state.tick >= 100);
    expect(of(events, 'stunned')).toHaveLength(5);
    // Hits land at ticks 9, 19, 39, 59, 79, 99: the ones after each stun (29, 49, ...) are swallowed.
    expect(of(events, 'playerHit')).toHaveLength(6);
  });

  it('ramp: damage grows with the seconds of the wave', () => {
    const { events } = play(setupOf([['rampant']], slow()), [], (r) => r.state.tick >= 100);
    const damages = of(events, 'enemyHit').map((e) => e.damage);
    expect(damages[0]).toBe(7); // 5 * (100 + 50 * 0.9) / 100
    expect(damages[damages.length - 1]).toBeGreaterThan(damages[0] as number);
  });

  it('armor: flat reduction, never below 1', () => {
    const strong = of(play(setupOf([['tank']], studentBuild({ logica: 10, foco: BIG_HP })), [], (r) => r.state.tick >= 10).events, 'playerHit');
    expect(strong[0]?.damage).toBe(7);
    const weak = of(play(setupOf([['tank']], slow()), [], (r) => r.state.tick >= 10).events, 'playerHit');
    expect(weak[0]?.damage).toBe(1);
  });

  it('split: dying enemies spawn minions that must also be killed', () => {
    const { events, run } = play(setupOf([['splitter']], studentBuild({ logica: 60, foco: BIG_HP })));
    const spawn = of(events, 'spawn')[0];
    expect(spawn?.enemies.map((e) => e.def)).toEqual(['mini', 'mini']);
    expect(run.state.enemies).toHaveLength(3);
    expect(run.state.phase).toBe('won');
    expect(of(events, 'waveCleared')).toHaveLength(1);
    expect(of(events, 'playerHit').filter((h) => h.killed)).toHaveLength(3);
  });

  it('timer: the wave is lost when the clock runs out', () => {
    const run = createRun(setupOf([['timed']], slow()), content);
    expect(run.state.waveTicksLeft).toBe(50);
    const { events, run: ended } = play(setupOf([['timed']], slow()));
    expect(of(events, 'end')[0]).toEqual({ type: 'end', won: false, reason: 'timeout' });
    expect(ended.state.tick).toBe(50);
  });

  it('charge: winds up, announces, then hits for the multiplier', () => {
    const { events } = play(setupOf([['charger']], slow()), [], (r) => r.state.tick >= 60);
    const start = of(events, 'chargeStart')[0];
    expect(start?.landsAt).toBe(45);
    const charged = of(events, 'enemyHit').find((e) => e.charged);
    expect(charged).toMatchObject({ damage: 20, blocked: false });
  });

  it('charge: a block raised before the hit lands negates it', () => {
    const { events } = play(setupOf([['charger']], studentBuild({ logica: 1, foco: BIG_HP }, ['block'])), [{ tick: 40, kind: 'skill', skill: 'block' }], (r) => r.state.tick >= 60);
    expect(of(events, 'enemyHit').find((e) => e.charged)).toMatchObject({ damage: 0, blocked: true });
  });

  it('charge: the hit ignores its own enemy ramp (base damage only)', () => {
    const stage = setupOf([['charger']], slow(), {}, { level: 3 });
    const { events } = play(stage, [], (r) => r.state.tick >= 60);
    // level 3: damage 5 * 124% = 6, x4
    expect(of(events, 'enemyHit').find((e) => e.charged)?.damage).toBe(24);
  });
});

describe('enemy scaling and daily modifiers', () => {
  it('scales hp by the stage level', () => {
    const run = createRun(setupOf([['grunt']], slow(), {}, { level: 3 }), content);
    expect(run.state.enemies[0]?.maxHp).toBe(68); // 50 * (100 + 18 * 2) / 100
  });

  it('adds daily percentages (100 means double, negative means less)', () => {
    const double = createRun(setupOf([['grunt']], slow(), {}, { modifiers: [{ id: 'a', name: 'a', description: '', enemyHpPercent: 100 }] }), content);
    expect(double.state.enemies[0]?.maxHp).toBe(100);
    const less = createRun(setupOf([['grunt']], slow(), {}, { modifiers: [{ id: 'a', name: 'a', description: '', enemyHpPercent: -30 }] }), content);
    expect(less.state.enemies[0]?.maxHp).toBe(35);
  });

  it('noHealing blocks heal skills and buff heals', () => {
    const stage = { modifiers: [{ id: 'd', name: 'd', description: '', noHealing: true }] };
    const build = studentBuild({ foco: 1000 }, ['heal']);
    const { events } = play(setupOf([['grunt']], build, {}, stage), [{ tick: 25, kind: 'skill', skill: 'heal' }], (r) => r.state.tick >= 40);
    expect(of(events, 'skill')).toHaveLength(1);
    expect(of(events, 'heal')).toHaveLength(0);
  });
});

describe('player damage', () => {
  it('uses the boss damage bonus only against bosses', () => {
    const build = { ...studentBuild({ logica: 10, foco: BIG_HP }), meta: { ...studentBuild().meta, bossDamage: 100 } };
    const hit = (enemy: string) => of(play(setupOf([[enemy]], build), [], (r) => r.state.tick >= 10).events, 'playerHit')[0]?.damage;
    expect(hit('boss')).toBe(20);
    expect(hit('grunt')).toBe(10);
  });

  it('crit splash hits the other enemies too', () => {
    const build = { ...studentBuild({ atencao: 100, logica: 10, foco: BIG_HP }), uniques: [{ kind: 'critSplash' as const, description: '', chance: 100 }] };
    const { events } = play(setupOf([['grunt', 'grunt']], build), [], (r) => r.state.tick >= 10);
    const hits = of(events, 'playerHit');
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.crit && h.damage === 20)).toBe(true);
    expect(new Set(hits.map((h) => h.target)).size).toBe(2);
  });

  it('attacks the first living enemy', () => {
    const { events } = play(setupOf([['grunt', 'tank']], studentBuild({ logica: 60, foco: BIG_HP })), [], (r) => r.state.tick >= 10);
    expect(of(events, 'playerHit')[0]?.target).toBe(1);
  });
});

describe('flow', () => {
  it('is accepted at 0 and 40, ignored in between, and the hit is a guaranteed crit', () => {
    const build = studentBuild({ atencao: 0, logica: 1, foco: BIG_HP });
    const schedule: RunAction[] = [
      { tick: 0, kind: 'flow' },
      { tick: 5, kind: 'flow' },
      { tick: 39, kind: 'flow' },
      { tick: 40, kind: 'flow' },
    ];
    const { events } = play(setupOf([['grunt']], build), schedule, (r) => r.state.tick >= 60);
    const hits = of(events, 'playerHit');
    expect(hits.filter((h) => h.flow)).toHaveLength(2);
    expect(hits[0]).toMatchObject({ flow: true, crit: true, damage: 2 });
    expect(hits[1]).toMatchObject({ flow: false, crit: false, damage: 1 });
    const run = createRun(setupOf([['grunt']], build), content);
    stepRun(run, [{ tick: 0, kind: 'flow' }], content);
    expect(run.state.player).toMatchObject({ flowReady: true, flowAvailableAt: 40 });
  });
});

describe('skills', () => {
  const castAt = (tick: number, skill: string): RunAction => ({ tick, kind: 'skill', skill });

  it('heal restores a share of max HP, capped by what is missing', () => {
    const build = studentBuild({ foco: 100, logica: 1 }, ['heal']);
    const { events, run } = play(setupOf([['grunt']], build), [castAt(20, 'heal')], (r) => r.state.tick >= 21);
    expect(of(events, 'heal')[0]?.amount).toBe(10);
    expect(run.state.player.hp).toBe(100);
  });

  it('aoe hits every living enemy for the multiple of a hit', () => {
    const { events } = play(setupOf([['grunt', 'grunt']], studentBuild({ logica: 10, foco: BIG_HP }, ['aoe'])), [castAt(0, 'aoe')], (r) => r.state.tick >= 1);
    const hits = of(events, 'playerHit');
    expect(hits.map((h) => h.damage)).toEqual([20, 20]);
  });

  it('strike hits the current target hard', () => {
    const { events } = play(setupOf([['grunt', 'grunt']], studentBuild({ logica: 10, foco: BIG_HP }, ['strike'])), [castAt(0, 'strike')], (r) => r.state.tick >= 1);
    expect(of(events, 'playerHit')).toEqual([expect.objectContaining({ target: 1, damage: 40 })]);
  });

  it('haste speeds up the attack for its duration', () => {
    const hits = (schedule: RunAction[]) =>
      of(play(setupOf([['grunt']], studentBuild({ logica: 1, foco: BIG_HP }, ['haste'])), schedule, (r) => r.state.tick >= 100).events, 'playerHit').length;
    expect(hits([])).toBe(10);
    expect(hits([castAt(0, 'haste')])).toBe(15);
  });

  it('block negates one hit and is consumed', () => {
    const { events } = play(setupOf([['grunt']], studentBuild({ logica: 1, foco: BIG_HP }, ['block'])), [castAt(0, 'block')], (r) => r.state.tick >= 30);
    const hits = of(events, 'enemyHit');
    expect(hits[0]).toMatchObject({ blocked: true, damage: 0 });
    expect(hits[1]).toMatchObject({ blocked: false });
  });

  it('skillPower strengthens and cooldown meta shortens', () => {
    const meta = { ...studentBuild().meta, skillPower: 100, cooldown: 50 };
    const build = { ...studentBuild({ logica: 10, foco: BIG_HP }, ['strike']), meta };
    const run = createRun(setupOf([['grunt']], build), content);
    const events = stepRun(run, [castAt(0, 'strike')], content);
    expect(of(events, 'playerHit')[0]?.damage).toBe(80);
    expect(run.state.skills[0]?.readyAt).toBe(30); // 6000 ms = 60 ticks, halved
  });

  it('refuses a skill on cooldown, not equipped, or in auto mode', () => {
    const build = studentBuild({ logica: 10, foco: BIG_HP }, ['strike']);
    const run = createRun(setupOf([['grunt']], build), content);
    const events = stepRun(run, [castAt(0, 'strike'), castAt(0, 'strike'), castAt(0, 'haste')], content);
    expect(of(events, 'skill')).toHaveLength(1);
    const auto = createRun(setupOf([['grunt']], build, { auto: false }), content);
    const second = stepRun(auto, [castAt(0, 'strike')], content);
    expect(of(second, 'skill')[0]?.auto).toBe(false);
  });
});

describe('auto mode', () => {
  it('fires skills by itself at the auto power and ignores skill actions', () => {
    const build = studentBuild({ logica: 10, foco: BIG_HP }, ['strike']);
    const run = createRun(setupOf([['grunt']], build, { auto: true }), content);
    const events = stepRun(run, [{ tick: 0, kind: 'skill', skill: 'strike' }], content);
    expect(of(events, 'skill')).toEqual([{ type: 'skill', skill: 'strike', auto: true }]);
    expect(of(events, 'playerHit')[0]?.damage).toBe(32); // 10 * 4 * 0.8
  });

  it('heals only when enough HP is missing', () => {
    const build = studentBuild({ logica: 1, foco: 100 }, ['heal']);
    const { events } = play(setupOf([['grunt']], build, { auto: true }), [], (r) => r.state.tick >= 60);
    // Heal 24 (30% x 0.8): needs 12 missing HP, i.e. 3 grunt hits of 5.
    const skillTicks = of(events, 'skill');
    expect(skillTicks.length).toBeGreaterThanOrEqual(1);
    expect(of(events, 'heal')[0]?.amount).toBeGreaterThan(0);
  });

  it('blocks only while a charge is winding up', () => {
    const build = studentBuild({ logica: 1, foco: BIG_HP }, ['block']);
    const { events } = play(setupOf([['charger']], build, { auto: true }), [], (r) => r.state.tick >= 60);
    expect(of(events, 'enemyHit').find((e) => e.charged)).toMatchObject({ blocked: true });
    expect(of(events, 'skill').length).toBe(1);
  });

  it('does not use block without a charge', () => {
    const build = studentBuild({ logica: 1, foco: BIG_HP }, ['block']);
    const { events } = play(setupOf([['grunt']], build, { auto: true }), [], (r) => r.state.tick >= 50);
    expect(of(events, 'skill')).toHaveLength(0);
  });
});

describe('waves, choices and buffs', () => {
  const strong = () => studentBuild({ logica: 100, foco: BIG_HP });
  const threeWaves = [['grunt'], ['grunt'], ['grunt']];

  it('freezes time while choosing and applies the picked buff', () => {
    const run = createRun(setupOf(threeWaves, strong()), content);
    while (run.state.phase === 'fighting') stepRun(run, [], content);
    expect(run.state.phase).toBe('choosing');
    const offer = run.state.offer;
    expect(offer).not.toBeNull();
    const tick = run.state.tick;
    for (let i = 0; i < 20; i += 1) expect(stepRun(run, [], content)).toEqual([]);
    expect(run.state.tick).toBe(tick);
    stepRun(run, [{ tick: tick - 1, kind: 'choice', option: 1 }], content);
    expect(run.state.phase).toBe('choosing');
    const events = stepRun(run, [{ tick, kind: 'choice', option: 1 }], content);
    expect(of(events, 'buffPicked')[0]?.buff).toBe(offer?.[1]);
    expect(run.state.buffs).toEqual([offer?.[1]]);
    expect(run.state.phase).toBe('fighting');
    expect(run.state.wave).toBe(1);
    expect(of(events, 'waveStart')).toHaveLength(1);
  });

  it('rolls offers from the seed alone, three distinct and never repeated', () => {
    const offers = (option: 0 | 1 | 2) => {
      const out: string[][] = [];
      const run = createRun(setupOf(threeWaves, strong()), content);
      for (let i = 0; i < 5000 && run.state.phase !== 'won'; i += 1) {
        const tick = run.state.tick;
        if (run.state.phase === 'choosing' && run.state.offer) out.push([...run.state.offer]);
        stepRun(run, [{ tick, kind: 'choice', option }], content);
      }
      return out;
    };
    const a = offers(0);
    expect(a).toEqual(offers(2));
    expect(a).toHaveLength(2);
    const flat = a.flat();
    expect(new Set(flat).size).toBe(6);
  });

  it('picks the first option when no choice arrives and applies stat buffs and heals', () => {
    const outcome = simulateRun(setupOf(threeWaves, strong()), [], content);
    expect(outcome).toMatchObject({ won: true, wavesCleared: 3 });
  });

  it('a buff that adds max HP also heals that much', () => {
    const offerBuff = (id: string) => ({ ...content, waveBuffs: content.waveBuffs.filter((b) => b.id === id) });
    const only = offerBuff('buff-1'); // foco +10
    const small = createRun(setupOf(threeWaves, studentBuild({ logica: 100, foco: 100 })), only);
    while (small.state.phase === 'fighting') stepRun(small, [], only);
    stepRun(small, [{ tick: small.state.tick, kind: 'choice', option: 0 }], only);
    expect(small.state.player.maxHp).toBe(110);
  });

  it('keeps the last wave last and shuffles the others by seed', () => {
    const waves = [['grunt'], ['tank'], ['stunner'], ['splitter'], ['boss']];
    const firstWaves = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const run = createRun(setupOf(waves, strong(), { seed }), content);
      const again = createRun(setupOf(waves, strong(), { seed }), content);
      expect(again.state.enemies[0]?.def).toBe(run.state.enemies[0]?.def);
      firstWaves.add(run.state.enemies[0]?.def ?? '');
      let events: FightEvent[] = [];
      let last = '';
      for (let i = 0; i < 20000 && run.state.phase !== 'won' && run.state.phase !== 'lost'; i += 1) {
        const tick = run.state.tick;
        events = stepRun(run, [{ tick, kind: 'choice', option: 0 }], content);
        for (const e of events) if (e.type === 'waveStart') last = e.enemies[0]?.def ?? '';
      }
      expect(last).toBe('boss');
    }
    expect(firstWaves.size).toBeGreaterThan(1);
    expect(firstWaves.has('boss')).toBe(false);
  });
});

describe('unique effects', () => {
  it('second wind saves from a killing blow once per stage', () => {
    const wind = { kind: 'secondWind' as const, description: '' };
    const build = { ...studentBuild({ logica: 1, foco: 3 }), uniques: [wind, wind] };
    const { events, run } = play(setupOf([['grunt']], build));
    expect(of(events, 'secondWind')).toHaveLength(1);
    expect(run.state.phase).toBe('lost');
    expect(of(events, 'enemyHit').length).toBe(2);
  });
});

describe('invalid actions', () => {
  it('are ignored, not thrown', () => {
    const build = studentBuild({ logica: 50, foco: BIG_HP });
    const waves = [['grunt'], ['grunt'], ['grunt']];
    const junk: RunAction[] = [
      { tick: 0, kind: 'choice', option: 2 },
      { tick: 0, kind: 'skill', skill: 'strike' },
      { tick: 3, kind: 'flow' },
      { tick: 3, kind: 'flow' },
      { tick: -4, kind: 'flow' },
      { tick: 1.5, kind: 'flow' },
      { tick: 9999999, kind: 'skill', skill: 'nope' },
      { tick: 7, kind: 'choice', option: 9 as 0 },
    ];
    const clean: RunAction[] = [{ tick: 3, kind: 'flow' }];
    expect(simulateRun(setupOf(waves, build), junk, content)).toEqual(simulateRun(setupOf(waves, build), clean, content));
  });

  it('does nothing after the end', () => {
    const { run } = play(setupOf([['grunt']], studentBuild({ logica: 100, foco: BIG_HP })));
    const state = run.state;
    expect(stepRun(run, [{ tick: run.state.tick, kind: 'flow' }], content)).toEqual([]);
    expect(run.state).toBe(state);
  });
});
