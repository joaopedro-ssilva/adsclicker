import { useCloud } from '@/game/cloud';
import { useGame } from '@/game/store';
import { hackathonContent } from '@/hackathon/content';
import { createRun, stepRun } from '@/hackathon/engine';
import { hackathonApi } from '@/shared/hackathonClient';
import { toast } from '@/ui/kit';
import { createHackathonStore } from './createHackathon';
import type { FightEventListener } from './types';

export type * from './types';

const { store, subscribe } = createHackathonStore({
  api: hackathonApi,
  engine: { createRun, stepRun },
  content: hackathonContent,
  classroom: {
    buyCafe: () => useGame.getState().buyCafe(),
    syncNow: () => useCloud.getState().syncNow(),
  },
  clock: () => performance.now(),
  timers: { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) },
  notify: (message) => toast({ title: 'Hackathon', description: message, tone: 'bad' }),
});

/** The Hackathon mode: profile, mode switch and the running fight. Nothing is saved on the device. */
export const useHackathon = store;

/** Subscribes to the events of the running fight. Returns the unsubscribe function. */
export function subscribeFightEvents(listener: FightEventListener): () => void {
  return subscribe(listener);
}
