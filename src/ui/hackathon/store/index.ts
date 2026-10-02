import { create } from 'zustand';
import type { ActionResult, FightEventListener, HackathonStore } from './types';

export type * from './types';

const unavailable: ActionResult = { ok: false, message: 'Hackathon indisponível.' };

/** Placeholder with the final interface: the arena engineer owns and replaces this file. */
export const useHackathon = create<HackathonStore>((set) => ({
  mode: 'classroom',
  status: 'idle',
  lockReason: null,
  profile: null,
  run: null,
  lastResult: null,
  pending: false,
  setMode: (mode) => set({ mode }),
  load: async () => {},
  createStudent: async () => unavailable,
  startRun: async () => unavailable,
  flowClick: () => {},
  useSkill: () => {},
  choose: () => {},
  abandonRun: () => {},
  dismissResult: () => {},
  equip: async () => unavailable,
  buyNode: async () => unavailable,
  respec: async () => unavailable,
  setActiveSkills: async () => unavailable,
  buyMentor: async () => unavailable,
  recycle: async () => unavailable,
  reroll: async () => unavailable,
  buyCafe: async () => unavailable,
}));

/** Subscribes to the events of the running fight. Returns the unsubscribe function. */
export function subscribeFightEvents(listener: FightEventListener): () => void {
  void listener;
  return () => {};
}
