import { describe, expect, it } from 'vitest';
import { hackathonContent } from '@/hackathon/content';
import type { FightEvent, Run, RunAction, RunSetup, RunState } from '@/hackathon/engine/types';
import { TICK_MS } from '@/hackathon/engine/types';
import type { ApiResult } from '@/shared/apiClient';
import type { HackathonProfile, ProfileResponse, RunFinishResponse, RunStartResponse } from '@/shared/hackathonApi';
import {
  AUTO_CHOICE_MS,
  END_HOLD_MS,
  FLOW_CLICKS,
  MAX_STEPS_PER_PUMP,
  START_DELAY_MS,
  createHackathonStore,
} from './createHackathon';
import type { HackathonDeps } from './createHackathon';

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (status: number, code: 'unavailable' | 'forbidden' | 'not_found' | 'unauthorized', message = 'Erro do servidor.') =>
  ({ ok: false, error: { code, message }, status }) as const;
const network = fail(0, 'unavailable', 'Sem conexão com o servidor.');

const profile = (patch: Partial<HackathonProfile> = {}): HackathonProfile =>
  ({
    head: 'cacheado',
    cargo: 'estudante',
    level: 1,
    xp: 0,
    xpToNext: 100,
    commits: 0,
    cafe: { count: 3, max: 5, nextAt: null },
    ...patch,
  }) as HackathonProfile;

const rewards = { xp: 60, commits: 20, items: [], recycledCommits: 0, levelsGained: 0, promotedTo: null, firstClear: true };
const finished = (won: boolean): RunFinishResponse => ({
  outcome: { won, reason: won ? 'cleared' : 'defeated', wavesCleared: 1, ticks: 5, hpLeft: 1 },
  rewards,
  profile: profile({ xp: 60 }),
});

const stage = hackathonContent.stages[0];
if (!stage) throw new Error('content has no stage');
const startData = (patch: Partial<RunStartResponse> = {}): RunStartResponse => ({
  runId: 'run-1',
  seed: 1234,
  auto: false,
  build: { stats: { logica: 10, agilidade: 100, foco: 100, resiliencia: 0, atencao: 5, sorte: 0 }, meta: {} as never, skills: ['deploy'], uniques: [], sets: {} },
  stage: { ...stage, modifiers: [] },
  profile: profile({ cafe: { count: 2, max: 5, nextAt: null } }),
  ...patch,
});

const baseState = (patch: Partial<RunState> = {}): RunState => ({
  tick: 0,
  phase: 'fighting',
  wave: 0,
  waveCount: 2,
  player: { hp: 100, maxHp: 100, flowReady: false, flowAvailableAt: 0, blockUntil: 0, hasteUntil: 0, stunned: false },
  enemies: [],
  skills: [{ id: 'deploy', readyAt: 0 }],
  offer: null,
  buffs: [],
  waveTicksLeft: null,
  ...patch,
});

/** A scripted engine: the phase follows `script` by tick. Records what it was given. */
function fakeEngine(script: (tick: number) => Partial<RunState> = () => ({})) {
  const steps: { tick: number; actions: RunAction[] }[] = [];
  const setups: RunSetup[] = [];
  let flowAvailableAt = 0;
  return {
    steps,
    setups,
    engine: {
      createRun(setup: RunSetup): Run {
        setups.push(setup);
        return { setup, state: baseState() };
      },
      stepRun(run: Run, actions: RunAction[]): FightEvent[] {
        const tick = run.state.tick;
        steps.push({ tick, actions });
        const phase = script(tick).phase ?? 'fighting';
        const choosing = run.state.phase === 'choosing';
        if (choosing && !actions.some((action) => action.kind === 'choice')) return [];
        if (actions.some((action) => action.kind === 'flow')) flowAvailableAt = tick + 40;
        run.state = baseState({ ...script(tick + 1), tick: choosing ? tick + 1 : tick + 1, player: { ...baseState().player, flowAvailableAt } });
        if (phase === 'won' || phase === 'lost') run.state = { ...run.state, phase };
        return [{ type: 'stunned' }];
      },
    },
  };
}

interface Options {
  script?: (tick: number) => Partial<RunState>;
  profileResults?: ApiResult<ProfileResponse>[];
}

function setup(options: Options = {}) {
  let time = 1_000;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  let nextId = 0;
  const fake = fakeEngine(options.script);
  const calls = { startRun: [] as unknown[], finishRun: [] as { runId: string; actions: RunAction[] }[], syncNow: 0, buyCafe: 0, notify: [] as string[] };
  const queues = {
    profile: [...(options.profileResults ?? [])],
    startRun: [] as ApiResult<RunStartResponse>[],
    finishRun: [] as ApiResult<RunFinishResponse>[],
  };
  const world = { canAfford: true, cafeOnServer: 3 };

  const deps: HackathonDeps = {
    api: {
      profile: async () => queues.profile.shift() ?? ok({ unlocked: true, lockReason: null, profile: profile({ cafe: { count: world.cafeOnServer, max: 5, nextAt: null } }) }),
      createProfile: async () => ok({ profile: profile() }),
      startRun: async (body) => {
        calls.startRun.push(body);
        return queues.startRun.shift() ?? ok(startData({ auto: body.auto }));
      },
      finishRun: async (body) => {
        calls.finishRun.push({ runId: body.runId, actions: body.actions as RunAction[] });
        return queues.finishRun.shift() ?? ok(finished(true));
      },
      equip: async () => ok({ profile: profile({ level: 2 }) }),
      skills: async () => fail(0, 'forbidden', 'Nada.'),
      mentor: async () => ok({ profile: profile() }),
      items: async () => ok({ profile: profile() }),
    },
    engine: fake.engine,
    content: hackathonContent,
    classroom: {
      buyCafe: () => {
        calls.buyCafe += 1;
        return world.canAfford;
      },
      syncNow: async () => {
        calls.syncNow += 1;
        if (world.canAfford && calls.buyCafe > 0) world.cafeOnServer = 4;
      },
    },
    clock: () => time,
    timers: {
      set: (fn, ms) => {
        const entry = { id: (nextId += 1), at: time + ms, fn };
        timers.push(entry);
        return entry.id;
      },
      clear: (handle) => {
        const index = timers.findIndex((entry) => entry.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    },
    notify: (message) => calls.notify.push(message),
  };
  const { store, subscribe } = createHackathonStore(deps);

  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  /** Moves the clock, firing every due timer in order, letting promises settle between them. */
  async function advance(ms: number) {
    const target = time + ms;
    for (;;) {
      await settle();
      const due = timers.filter((entry) => entry.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      time = Math.max(time, due.at);
      due.fn();
    }
    time = target;
    await settle();
  }
  /** One real stall: the clock jumps, then the next timer pass catches up. */
  async function stall(ms: number) {
    time += ms;
    await advance(0);
  }
  async function ready() {
    store.getState().setMode('hackathon');
    await settle();
  }
  return { store, subscribe, world, queues, calls, fake, advance, stall, ready, settle };
}

const FIRST_TICK = START_DELAY_MS + TICK_MS;

describe('loading', () => {
  it('is ready with a profile', async () => {
    const t = setup();
    await t.ready();
    expect(t.store.getState().mode).toBe('hackathon');
    expect(t.store.getState().status).toBe('ready');
    expect(t.store.getState().profile?.head).toBe('cacheado');
  });

  it('is creating when unlocked without a profile', async () => {
    const t = setup({ profileResults: [ok({ unlocked: true, lockReason: null, profile: null })] });
    await t.ready();
    expect(t.store.getState().status).toBe('creating');
  });

  it('is locked with the server reason, after syncing once to be sure', async () => {
    const t = setup({
      profileResults: [
        ok({ unlocked: false, lockReason: 'Contrate a Bruna.', profile: null }),
        ok({ unlocked: false, lockReason: 'Contrate a Bruna.', profile: null }),
      ],
    });
    await t.ready();
    expect(t.store.getState().status).toBe('locked');
    expect(t.store.getState().lockReason).toBe('Contrate a Bruna.');
    expect(t.calls.syncNow).toBe(1);
  });

  it('unlocks when the sync made the server see the hire', async () => {
    const t = setup({
      profileResults: [ok({ unlocked: false, lockReason: 'x', profile: null }), ok({ unlocked: true, lockReason: null, profile: profile() })],
    });
    await t.ready();
    expect(t.store.getState().status).toBe('ready');
  });

  it.each([
    ['network error', network],
    ['unavailable', fail(503, 'unavailable')],
    ['404', fail(404, 'not_found')],
  ])('is offline on %s', async (_name, result) => {
    const t = setup({ profileResults: [result] });
    await t.ready();
    expect(t.store.getState().status).toBe('offline');
  });

  it('creates the student', async () => {
    const t = setup({ profileResults: [ok({ unlocked: true, lockReason: null, profile: null })] });
    await t.ready();
    expect(await t.store.getState().createStudent('cacheado')).toEqual({ ok: true });
    expect(t.store.getState().status).toBe('ready');
  });

  it('does not leave a fight by switching to the classroom', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    t.store.getState().setMode('classroom');
    expect(t.store.getState().mode).toBe('hackathon');
  });
});

describe('mutations', () => {
  it('updates the profile and returns the server message on failure', async () => {
    const t = setup();
    await t.ready();
    expect(await t.store.getState().equip('setup', null)).toEqual({ ok: true });
    expect(t.store.getState().profile?.level).toBe(2);
    expect(await t.store.getState().buyNode('x')).toEqual({ ok: false, message: 'Nada.' });
  });

  it('buys a Café in the classroom, syncs and reloads the profile', async () => {
    const t = setup();
    await t.ready();
    expect(await t.store.getState().buyCafe()).toEqual({ ok: true });
    expect(t.calls.buyCafe).toBe(1);
    expect(t.store.getState().profile?.cafe.count).toBe(4);
    expect(t.store.getState().pending).toBe(false);
  });

  it('says so when the ADScoins are not enough and does not sync', async () => {
    const t = setup();
    await t.ready();
    t.world.canAfford = false;
    const syncs = t.calls.syncNow;
    const result = await t.store.getState().buyCafe();
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toMatch(/ADScoins/);
    expect(t.calls.syncNow).toBe(syncs);
  });

  it('refuses a Café when it is already full', async () => {
    const t = setup({ profileResults: [ok({ unlocked: true, lockReason: null, profile: profile({ cafe: { count: 5, max: 5, nextAt: null } }) })] });
    await t.ready();
    const result = await t.store.getState().buyCafe();
    expect(result.ok).toBe(false);
    expect(t.calls.buyCafe).toBe(0);
  });
});

describe('the fight loop', () => {
  it('creates the run from the server answer and ticks once per TICK_MS', async () => {
    const t = setup();
    await t.ready();
    expect(await t.store.getState().startRun('cap1-fase1', false)).toEqual({ ok: true });
    expect(t.fake.setups[0]).toMatchObject({ seed: 1234, auto: false });
    expect(t.store.getState().profile?.cafe.count).toBe(2);
    expect(t.store.getState().run?.runId).toBe('run-1');
    await t.advance(START_DELAY_MS - 1);
    expect(t.fake.steps).toHaveLength(0);
    await t.advance(1);
    expect(t.fake.steps).toHaveLength(1);
    await t.advance(TICK_MS * 4);
    expect(t.fake.steps).toHaveLength(5);
    expect(t.store.getState().run?.state.tick).toBe(5);
  });

  it('returns the server message when the start is refused', async () => {
    const t = setup();
    await t.ready();
    t.queues.startRun.push(fail(403, 'forbidden', 'Sem Café.'));
    expect(await t.store.getState().startRun('cap1-fase1', false)).toEqual({ ok: false, message: 'Sem Café.' });
    expect(t.store.getState().run).toBeNull();
  });

  it('catches up a stall tick by tick without skipping, in bounded passes', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS);
    const before = t.fake.steps.length;
    await t.stall(TICK_MS * 130);
    const ticks = t.fake.steps.map((step) => step.tick);
    expect(ticks.length - before).toBe(130);
    expect(ticks).toEqual(ticks.map((_, index) => index)); // contiguous: no tick was skipped
    expect(MAX_STEPS_PER_PUMP).toBeLessThan(130);
  });

  it('stamps actions with the current tick and records every one', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS + TICK_MS * 3);
    t.store.getState().useSkill('deploy');
    t.store.getState().useSkill('deploy'); // a second press in the same tick is not recorded twice
    t.store.getState().useSkill('nope');
    await t.advance(TICK_MS);
    const withSkill = t.fake.steps.find((step) => step.actions.length > 0);
    expect(withSkill?.actions).toEqual([{ tick: withSkill?.tick, kind: 'skill', skill: 'deploy' }]);
    expect(withSkill?.tick).toBe(4);
  });

  it('fills the Flow bar with clicks and fires it once, then keeps it full while unavailable', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS);
    for (let i = 0; i < FLOW_CLICKS - 1; i += 1) t.store.getState().flowClick();
    expect(t.store.getState().run?.flowCharge).toBeGreaterThan(0.85);
    expect(t.store.getState().run?.flowCharge).toBeLessThan(1);
    t.store.getState().flowClick();
    expect(t.store.getState().run?.flowCharge).toBe(0); // fired
    await t.advance(TICK_MS);
    expect(t.fake.steps.flatMap((step) => step.actions).filter((action) => action.kind === 'flow')).toHaveLength(1);

    // The engine now refuses another Flow for 40 ticks: the bar fills and waits.
    for (let i = 0; i < FLOW_CLICKS * 2; i += 1) t.store.getState().flowClick();
    expect(t.store.getState().run?.flowCharge).toBe(1);
    await t.advance(TICK_MS * 45);
    expect(t.fake.steps.flatMap((step) => step.actions).filter((action) => action.kind === 'flow')).toHaveLength(2);
    expect(t.store.getState().run?.flowCharge).toBe(0);
  });

  it('ignores skills in auto mode', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', true);
    await t.advance(START_DELAY_MS + TICK_MS);
    t.store.getState().useSkill('deploy');
    await t.advance(TICK_MS * 2);
    expect(t.fake.steps.flatMap((step) => step.actions)).toHaveLength(0);
  });

  it('waits for the choice with the clock frozen, then continues without owing the time', async () => {
    const t = setup({ script: (tick) => (tick === 3 ? { phase: 'choosing', offer: ['a', 'b', 'c'] } : {}) });
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(FIRST_TICK + TICK_MS * 5);
    expect(t.store.getState().run?.state.phase).toBe('choosing');
    const stepsWhileWaiting = t.fake.steps.length;
    await t.advance(60_000);
    expect(t.fake.steps.length).toBe(stepsWhileWaiting);
    t.store.getState().choose(2);
    await t.advance(0);
    expect(t.fake.steps.at(-1)?.actions).toEqual([{ tick: 3, kind: 'choice', option: 2 }]);
    await t.advance(TICK_MS * 2);
    // Two ticks after the choice, not 600 ticks of the minute spent waiting.
    expect(t.fake.steps.length).toBeLessThan(stepsWhileWaiting + 6);
  });

  it('picks the first upgrade for the player in auto mode after a pause', async () => {
    const t = setup({ script: (tick) => (tick === 2 ? { phase: 'choosing', offer: ['a', 'b', 'c'] } : {}) });
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', true);
    await t.advance(FIRST_TICK + TICK_MS * 3);
    expect(t.store.getState().run?.state.phase).toBe('choosing');
    await t.advance(AUTO_CHOICE_MS + 50);
    expect(t.fake.steps.flatMap((step) => step.actions)).toContainEqual({ tick: 2, kind: 'choice', option: 0 });
  });
});

describe('the end of a fight', () => {
  const winAt = (end: number) => (tick: number): Partial<RunState> => (tick >= end ? { phase: 'won' } : {});

  it('sends the recorded actions, then shows the result and clears the run', async () => {
    const t = setup({ script: winAt(6) });
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS + TICK_MS * 2);
    t.store.getState().useSkill('deploy');
    await t.advance(TICK_MS * 6);
    expect(t.calls.finishRun).toHaveLength(1);
    expect(t.calls.finishRun[0]?.actions).toEqual([{ tick: 3, kind: 'skill', skill: 'deploy' }]);
    expect(t.store.getState().run?.finishing).toBe(true); // banner time
    expect(t.store.getState().lastResult).toBeNull();
    await t.advance(END_HOLD_MS);
    expect(t.store.getState().run).toBeNull();
    expect(t.store.getState().lastResult?.outcome.won).toBe(true);
    expect(t.store.getState().profile?.xp).toBe(60);
    t.store.getState().dismissResult();
    expect(t.store.getState().lastResult).toBeNull();
  });

  it('retries after a lost connection and then succeeds', async () => {
    const t = setup({ script: winAt(2) });
    await t.ready();
    t.queues.finishRun.push(network, network);
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(FIRST_TICK + TICK_MS * 3);
    expect(t.calls.finishRun).toHaveLength(1);
    expect(t.store.getState().run?.finishError).toMatch(/Sem conexão/);
    await t.advance(1500);
    expect(t.calls.finishRun).toHaveLength(2);
    await t.advance(3000);
    expect(t.calls.finishRun).toHaveLength(3);
    await t.advance(END_HOLD_MS);
    expect(t.store.getState().lastResult).not.toBeNull();
    expect(t.calls.finishRun.every((call) => call.runId === 'run-1')).toBe(true);
  });

  it('tells the player when the server cannot judge the fight, and reloads the profile', async () => {
    const t = setup({ script: winAt(2) });
    await t.ready();
    t.queues.finishRun.push(fail(404, 'not_found', 'Essa luta expirou.'));
    // 404 is "offline" for the mode, but a finish answer with a body is final: use forbidden here.
    t.queues.finishRun.length = 0;
    t.queues.finishRun.push(fail(403, 'forbidden', 'Essa luta expirou.'));
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(FIRST_TICK + TICK_MS * 3 + END_HOLD_MS);
    expect(t.calls.notify).toEqual(['Essa luta expirou.']);
    expect(t.store.getState().run).toBeNull();
    expect(t.store.getState().lastResult).toBeNull();
  });

  it('finishes an abandoned fight with what was recorded', async () => {
    const t = setup();
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS + TICK_MS * 3);
    t.queues.finishRun.push(ok(finished(false)));
    t.store.getState().abandonRun();
    await t.advance(1000);
    expect(t.calls.finishRun).toHaveLength(1);
    expect(t.store.getState().run).toBeNull();
    expect(t.store.getState().lastResult?.outcome.won).toBe(false);
    const stepsAtAbandon = t.fake.steps.length;
    await t.advance(5000);
    expect(t.fake.steps.length).toBe(stepsAtAbandon); // the loop stopped
  });

  it('feeds the events of every tick to subscribers', async () => {
    const t = setup();
    const seen: { count: number; tick: number }[] = [];
    const off = t.subscribe((events, state) => seen.push({ count: events.length, tick: state.tick }));
    await t.ready();
    await t.store.getState().startRun('cap1-fase1', false);
    await t.advance(START_DELAY_MS + TICK_MS * 2);
    expect(seen).toEqual([
      { count: 1, tick: 1 },
      { count: 1, tick: 2 },
      { count: 1, tick: 3 },
    ]);
    off();
    await t.advance(TICK_MS * 2);
    expect(seen).toHaveLength(3);
  });
});
