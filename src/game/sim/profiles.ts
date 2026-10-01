import type { SimOptions } from './simulate';

export type ProfileId = 'active' | 'casual' | 'idle';

export interface Profile {
  id: ProfileId;
  label: string;
  description: string;
  options: SimOptions;
}

/**
 * The three players the balance is checked against. "Active" is the pacing reference of
 * GAME_DESIGN section 7; the others are compared with it.
 */
export const PROFILES: Record<ProfileId, Profile> = {
  active: {
    id: 'active',
    label: 'Ativo',
    description: '4 cliques/s, defende 80% das invasões, decide a cada segundo',
    options: { clicksPerSecond: 4, defendRate: 0.8, decisionMs: 1000 },
  },
  casual: {
    id: 'casual',
    label: 'Casual',
    description: '1 clique/s, defende 30% das invasões, decide a cada 5 s',
    options: { clicksPerSecond: 1, defendRate: 0.3, decisionMs: 5000 },
  },
  idle: {
    id: 'idle',
    label: 'Ocioso',
    description: '0,2 clique/s, defende 10% das invasões, olha o jogo a cada 60 s',
    options: { clicksPerSecond: 0.2, defendRate: 0.1, decisionMs: 60_000 },
  },
};

export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];
