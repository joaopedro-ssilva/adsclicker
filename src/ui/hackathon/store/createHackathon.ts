import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { HackathonContent, SlotId } from '@/hackathon/content/types';
import type { FightEvent, HackathonEngine, Run, RunAction } from '@/hackathon/engine/types';
import { TICK_MS } from '@/hackathon/engine/types';
import type { ProfessorId } from '@/game/content/types';
import type { ApiResult } from '@/shared/apiClient';
import type { hackathonApi as realApi } from '@/shared/hackathonClient';
import { MAX_RUN_ACTIONS, MAX_RUN_TICKS } from '@/shared/hackathonApi';
import type { HackathonProfile, ProfileOnlyResponse, RunFinishResponse } from '@/shared/hackathonApi';
import type { ActionResult, FightEventListener, HackathonState, HackathonStatus, HackathonStore } from './types';

/** Clicks that fill the Flow bar. */
export const FLOW_CLICKS = 11;
/** The real time between pressing "start" and the first tick, so the arena is on screen before anything happens. */
export const START_DELAY_MS = 700;
/** The end banner stays at least this long, while the server is already judging the fight. */
export const END_HOLD_MS = 1900;
/** In auto mode the player is not asked to hurry: the first upgrade is picked after this long. */
export const AUTO_CHOICE_MS = 7000;
/** Ticks run in one go after a stall. More than this yields to the browser, then continues: never skipped. */
export const MAX_STEPS_PER_PUMP = 50;
/** Wait before each new try of the finish request after a lost connection (the last delay repeats). */
export const FINISH_RETRY_MS = [1500, 3000, 5000];

type Api = Pick<typeof realApi, 'profile' | 'createProfile' | 'startRun' | 'finishRun' | 'equip' | 'skills' | 'mentor' | 'items'>;

/** What the Hackathon needs from the classroom game, so it can be tested without one. */
export interface ClassroomPort {
  /** Spends the ADScoins of a Café. False when the player cannot pay. */
  buyCafe(): boolean;
  /** Syncs the save now, which is when the server credits the Café. */
  syncNow(): Promise<void>;
}

export interface HackathonDeps {
  api: Api;
  engine: Pick<HackathonEngine, 'createRun' | 'stepRun'>;
  content: HackathonContent;
  classroom: ClassroomPort;
  /** Monotonic milliseconds. */
  clock: () => number;
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
  /** Tells the player something that has no screen of its own (a fight that could not be judged). */
  notify: (message: string) => void;
}

/** The fight being played: everything the loop needs that React must never see. */
interface Fight {
  runId: string;
  run: Run;
  auto: boolean;
  /** Actions of the current tick, not yet given to the engine. */
  queued: RunAction[];
  /** Every action that was given to the engine, in order: what the server replays. */
  recorded: RunAction[];
  flowCharge: number;
  /** Clock time at which the next tick is due. */
  nextTickAt: number;
  /** In auto mode, when the first upgrade is picked for the player. */
  choiceAt: number | null;
  timer: unknown;
  ended: boolean;
}

const OFFLINE_MESSAGE = 'O Hackathon precisa de conexão com o servidor.';
const BUSY: ActionResult = { ok: false, message: 'Já existe uma luta em andamento.' };

type Failure = ApiResult<never> & { ok: false };

/** The server, the network or a missing route: the mode simply is not there. */
function isOffline(result: Failure): boolean {
  return result.status === 0 || result.status === 404 || result.error.code === 'unavailable';
}

/**
 * The client store of the Hackathon mode. Everything is injected (api, engine, content, classroom, clock,
 * timers) so the fight loop can be tested with a fake clock.
 *
 * Time keeping: the fight advances one engine tick per TICK_MS of real time. `nextTickAt` moves forward by
 * exactly TICK_MS per tick, so a stalled tab (hidden, throttled) is caught up tick by tick, never skipped;
 * each pass runs at most MAX_STEPS_PER_PUMP ticks and yields before continuing. While the player is choosing
 * an upgrade the clock is frozen, like the engine's own time.
 */
export function createHackathonStore(deps: HackathonDeps): {
  store: UseBoundStore<StoreApi<HackathonStore>>;
  /** The events of every tick of the running fight, for animation and sound. */
  subscribe: (listener: FightEventListener) => () => void;
} {
  const { api, engine, content, classroom, clock, timers, notify } = deps;

  let fight: Fight | null = null;
  let inflight = 0;
  let loading: Promise<void> | null = null;
  const listeners = new Set<FightEventListener>();

  const store = create<HackathonStore>()((set, get) => {
    // ----- requests ---------------------------------------------------------

    const track = async <T,>(work: () => Promise<T>): Promise<T> => {
      inflight += 1;
      set({ pending: true });
      try {
        return await work();
      } finally {
        inflight -= 1;
        if (inflight === 0) set({ pending: false });
      }
    };

    const mutate = (call: () => Promise<ApiResult<ProfileOnlyResponse>>): Promise<ActionResult> =>
      track(async () => {
        const result = await call();
        if (!result.ok) return { ok: false, message: result.error.message };
        set({ profile: result.data.profile });
        return { ok: true };
      });

    const apply = (status: HackathonStatus, patch: Partial<HackathonState> = {}) => set({ status, ...patch });

    const fetchProfile = async (retried = false): Promise<void> => {
      const result = await api.profile();
      if (!result.ok) {
        if (result.error.code === 'unauthorized' && !retried) {
          // A new browser has no session until its first sync.
          await classroom.syncNow();
          return fetchProfile(true);
        }
        apply('offline', { lockReason: null });
        return;
      }
      const { unlocked, lockReason, profile } = result.data;
      if (!unlocked && !retried) {
        // The unlock is read from the cloud save: make sure the latest hire reached it.
        await classroom.syncNow();
        return fetchProfile(true);
      }
      if (!unlocked) apply('locked', { lockReason: lockReason ?? 'O Hackathon ainda não está liberado.', profile: null });
      else if (!profile) apply('creating', { lockReason: null, profile: null });
      else apply('ready', { lockReason: null, profile });
    };

    // ----- the fight loop ---------------------------------------------------

    const publish = (current: Fight, events: FightEvent[]) => {
      const active = get().run;
      if (active) {
        set({ run: { ...active, state: current.run.state, flowCharge: current.flowCharge } });
      }
      if (events.length > 0) listeners.forEach((listener) => listener(events, current.run.state));
    };

    const queue = (current: Fight, action: RunAction) => {
      if (current.recorded.length + current.queued.length >= MAX_RUN_ACTIONS) return;
      current.queued.push(action);
    };

    /** A full bar fires as soon as the engine allows it; until then it stays full. */
    const fireFlowIfReady = (current: Fight) => {
      const { state } = current.run;
      if (current.flowCharge < 1 || state.phase !== 'fighting') return;
      if (state.player.flowReady || state.tick < state.player.flowAvailableAt) return;
      if (current.queued.some((action) => action.kind === 'flow')) return;
      queue(current, { tick: state.tick, kind: 'flow' });
      current.flowCharge = 0;
    };

    const step = (current: Fight) => {
      fireFlowIfReady(current);
      const actions = current.queued.splice(0);
      current.recorded.push(...actions.filter((action) => action.tick <= MAX_RUN_TICKS));
      const events = engine.stepRun(current.run, actions, content);
      current.nextTickAt += TICK_MS;
      const { phase, tick } = current.run.state;
      const over = phase === 'won' || phase === 'lost' || tick >= MAX_RUN_TICKS;
      publish(current, events);
      if (over) {
        current.ended = true;
        void conclude(current, END_HOLD_MS);
      }
    };

    const schedule = (current: Fight, delay: number) => {
      if (current.timer !== null) timers.clear(current.timer);
      current.timer = timers.set(() => {
        current.timer = null;
        pump(current);
      }, Math.max(0, delay));
    };

    function pump(current: Fight): void {
      if (current.ended || fight !== current) return;
      let steps = 0;
      while (!current.ended && steps < MAX_STEPS_PER_PUMP) {
        const { state } = current.run;
        if (state.phase === 'choosing') {
          const picked = current.queued.some((action) => action.kind === 'choice');
          if (!picked) {
            current.nextTickAt = clock(); // frozen: the time spent choosing is not owed back
            if (current.auto) {
              current.choiceAt ??= clock() + AUTO_CHOICE_MS;
              if (clock() >= current.choiceAt) {
                queue(current, { tick: state.tick, kind: 'choice', option: 0 });
                continue;
              }
              schedule(current, current.choiceAt - clock());
            }
            return;
          }
          current.choiceAt = null;
        } else if (clock() < current.nextTickAt) {
          schedule(current, current.nextTickAt - clock());
          return;
        }
        step(current);
        steps += 1;
      }
      if (!current.ended) schedule(current, 0);
    }

    /** Ends the fight on screen and asks the server for the verdict, with retries on a lost connection. */
    async function conclude(current: Fight, holdMs: number): Promise<void> {
      if (current.timer !== null) timers.clear(current.timer);
      current.timer = null;
      const active = get().run;
      if (active) set({ run: { ...active, state: current.run.state, finishing: true, finishError: null } });

      const hold = new Promise<void>((resolve) => timers.set(resolve, holdMs));
      let answer: ApiResult<RunFinishResponse>;
      let attempt = 0;
      for (;;) {
        answer = await api.finishRun({ runId: current.runId, actions: current.recorded });
        if (answer.ok || !isOffline(answer) || fight !== current) break;
        const wait = FINISH_RETRY_MS[Math.min(attempt, FINISH_RETRY_MS.length - 1)] ?? 5000;
        attempt += 1;
        const shown = get().run;
        if (shown) set({ run: { ...shown, finishError: 'Sem conexão: tentando salvar a luta de novo...' } });
        await new Promise<void>((resolve) => timers.set(resolve, wait));
      }
      await hold;
      if (fight !== current) return;
      fight = null;
      if (answer.ok) {
        set({ run: null, lastResult: answer.data, profile: answer.data.profile });
      } else {
        set({ run: null });
        notify(answer.error.message);
        void fetchProfile();
      }
    }

    // ----- the store ---------------------------------------------------------

    return {
      mode: 'classroom',
      status: 'idle',
      lockReason: null,
      profile: null,
      run: null,
      lastResult: null,
      pending: false,

      setMode(mode) {
        if (mode === get().mode) return;
        if (mode === 'classroom' && fight) return; // a fight in progress cannot be left by switching screens
        set({ mode });
        if (mode === 'hackathon') void get().load();
      },

      load() {
        if (loading) return loading;
        if (get().profile === null) set({ status: 'loading' });
        loading = fetchProfile().finally(() => {
          loading = null;
        });
        return loading;
      },

      createStudent: (head) => mutate(() => api.createProfile({ head })).then((result) => {
        if (result.ok) set({ status: 'ready' });
        return result;
      }),

      async startRun(stageId, auto) {
        if (fight) return BUSY;
        if (get().status !== 'ready') return { ok: false, message: OFFLINE_MESSAGE };
        const result = await track(() => api.startRun({ stageId, auto }));
        if (!result.ok) return { ok: false, message: result.error.message };
        if (fight) return BUSY;
        const { runId, seed, build, stage, profile } = result.data;
        const run = engine.createRun({ seed, build, stage, auto: result.data.auto }, content);
        const current: Fight = {
          runId,
          run,
          auto: result.data.auto,
          queued: [],
          recorded: [],
          flowCharge: 0,
          nextTickAt: clock() + START_DELAY_MS,
          choiceAt: null,
          timer: null,
          ended: false,
        };
        fight = current;
        set({
          profile,
          lastResult: null,
          run: { runId, stage, build, auto: current.auto, state: run.state, flowCharge: 0, finishing: false, finishError: null },
        });
        schedule(current, START_DELAY_MS);
        return { ok: true };
      },

      flowClick() {
        const current = fight;
        if (!current || current.ended || current.run.state.phase !== 'fighting') return;
        current.flowCharge = Math.min(1, current.flowCharge + 1 / FLOW_CLICKS);
        fireFlowIfReady(current);
        publish(current, []);
      },

      useSkill(skill) {
        const current = fight;
        if (!current || current.ended || current.auto) return;
        const { state } = current.run;
        if (state.phase !== 'fighting') return;
        const entry = state.skills.find((candidate) => candidate.id === skill);
        if (!entry || state.tick < entry.readyAt) return;
        if (current.queued.some((action) => action.kind === 'skill' && action.skill === skill)) return;
        queue(current, { tick: state.tick, kind: 'skill', skill });
      },

      choose(option) {
        const current = fight;
        if (!current || current.ended || current.run.state.phase !== 'choosing') return;
        if (current.queued.some((action) => action.kind === 'choice')) return;
        queue(current, { tick: current.run.state.tick, kind: 'choice', option });
        current.nextTickAt = clock(); // the time spent choosing is not owed back
        schedule(current, 0);
      },

      abandonRun() {
        const current = fight;
        if (!current || current.ended) return;
        current.ended = true;
        void conclude(current, 600);
      },

      dismissResult: () => set({ lastResult: null }),

      equip: (slot: SlotId, itemId: string | null) => mutate(() => api.equip({ slot, itemId })),
      buyNode: (node) => mutate(() => api.skills({ action: 'buy', node })),
      respec: () => mutate(() => api.skills({ action: 'respec' })),
      setActiveSkills: (skills) => mutate(() => api.skills({ action: 'active', skills })),
      buyMentor: (professor: ProfessorId) => mutate(() => api.mentor({ professor })),
      recycle: (itemIds) => mutate(() => api.items({ action: 'recycle', itemIds })),
      reroll: (itemId, affixIndex) => mutate(() => api.items({ action: 'reroll', itemId, affixIndex })),

      async buyCafe() {
        const before: HackathonProfile | null = get().profile;
        if (before && before.cafe.count >= before.cafe.max) return { ok: false, message: 'O Café já está cheio.' };
        return track(async () => {
          if (!classroom.buyCafe()) return { ok: false, message: 'ADScoins insuficientes para comprar um Café.' };
          // The purchase reaches the server with the next sync; one that was already running may miss it.
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await classroom.syncNow();
            await fetchProfile();
            const now = get().profile;
            if (!before || !now || now.cafe.count > before.cafe.count || now.cafe.count >= now.cafe.max) break;
            await new Promise<void>((resolve) => timers.set(resolve, 1200));
          }
          return { ok: true };
        });
      },
    };
  });

  // The feed lives beside the store: the arena subscribes without going through React state.
  feeds.set(store, (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  return {
    store,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type Subscribe = (listener: FightEventListener) => () => void;
const feeds = new WeakMap<object, Subscribe>();

/** The events feed of a store made by `createHackathonStore`. */
export function fightEvents(store: object): Subscribe {
  const subscribe = feeds.get(store);
  if (!subscribe) throw new Error('Not a Hackathon store');
  return subscribe;
}
