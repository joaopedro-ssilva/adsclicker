import { describe, expect, it } from 'vitest';
import { hackathonContent } from '@/hackathon/content';
import { computeBuild, createRun, resolveStage, simulateRun, stepRun } from '@/hackathon/engine';
import type { RunAction, RunSetup } from '@/hackathon/engine';
import type { ApiResult } from '@/shared/apiClient';
import type { HackathonProfile, RunFinishResponse } from '@/shared/hackathonApi';
import { createHackathonStore } from './createHackathon';
import type { HackathonDeps } from './createHackathon';

/** The client loop with the real engine: what it records must replay to the very same fight on the server. */
describe('recorded actions replay to the same outcome', () => {
  it.each([false, true])('auto = %s', async (auto) => {
    const content = hackathonContent;
    const stage = resolveStage('cap1-fase3', '2026-10-02', content);
    if (!stage) throw new Error('stage missing');
    const build = computeBuild({ cargo: 'estudante', level: 3, skillNodes: {}, mentors: {}, equipped: {}, activeSkills: ['deploy'] }, content);
    const setup: RunSetup = { seed: 98765, build, stage, auto };

    let time = 0;
    const timers: { id: number; at: number; fn: () => void }[] = [];
    let ids = 0;
    let sent: { actions: RunAction[] } | null = null;
    const profile = { cafe: { count: 4, max: 5, nextAt: null }, cargo: 'estudante', head: 'x', level: 3 } as unknown as HackathonProfile;
    const deps: HackathonDeps = {
      api: {
        profile: async () => ({ ok: true, data: { unlocked: true, lockReason: null, profile } }),
        createProfile: async () => ({ ok: true, data: { profile } }),
        startRun: async () => ({ ok: true, data: { runId: 'r', seed: setup.seed, auto, build, stage, profile } }),
        finishRun: async (body) => {
          sent = { actions: body.actions as RunAction[] };
          return { ok: true, data: {} as RunFinishResponse } as ApiResult<RunFinishResponse>;
        },
        equip: async () => ({ ok: true, data: { profile } }),
        skills: async () => ({ ok: true, data: { profile } }),
        mentor: async () => ({ ok: true, data: { profile } }),
        items: async () => ({ ok: true, data: { profile } }),
      },
      engine: { createRun, stepRun },
      content,
      classroom: { buyCafe: () => true, syncNow: async () => undefined },
      clock: () => time,
      timers: {
        set: (fn, ms) => {
          timers.push({ id: (ids += 1), at: time + ms, fn });
          return ids;
        },
        clear: (handle) => {
          const index = timers.findIndex((entry) => entry.id === handle);
          if (index >= 0) timers.splice(index, 1);
        },
      },
      notify: () => undefined,
    };
    const { store, subscribe } = createHackathonStore(deps);
    const live: { end: string | null; tick: number; hp: number } = { end: null, tick: 0, hp: 0 };
    subscribe((events, state) => {
      live.tick = state.tick;
      live.hp = state.player.hp;
      for (const event of events) if (event.type === 'end') live.end = event.reason;
    });
    store.getState().setMode('hackathon');
    await new Promise((resolve) => setImmediate(resolve));
    await store.getState().startRun(stage.id, auto);

    // A "player": click a lot, press the skill whenever it is ready, take the middle upgrade.
    let guard = 0;
    while (sent === null && guard < 200_000) {
      guard += 1;
      const run = store.getState().run;
      if (run && !run.finishing) {
        store.getState().flowClick();
        if (run.state.phase === 'choosing') store.getState().choose(1);
        else store.getState().useSkill('deploy');
      }
      const next = timers.sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      timers.splice(timers.indexOf(next), 1);
      time = Math.max(time, next.at);
      next.fn();
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(sent).not.toBeNull();
    const actions = (sent as { actions: RunAction[] } | null)?.actions ?? [];
    expect(actions.length).toBeGreaterThan(0);

    const replay = simulateRun(setup, actions, content);
    expect(live.end).not.toBeNull();
    expect(replay).toMatchObject({ reason: live.end, ticks: live.tick, hpLeft: live.hp });
    expect(replay.ticks).toBeGreaterThan(10);
    expect(['cleared', 'defeated', 'timeout']).toContain(replay.reason);
    // Replaying twice is identical (determinism of the recorded input).
    expect(simulateRun(setup, actions, content)).toEqual(replay);
  });
});
