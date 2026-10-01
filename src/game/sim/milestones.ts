import { hiredCount } from '../engine/economy';
import type { GameState } from '../engine/state';

export type MilestoneId =
  | 'firstUpgrade'
  | 'gladimir'
  | 'firstSkin'
  | 'fourProfessors'
  | 'angelo'
  | 'graduationAvailable'
  | 'firstGraduation'
  | 'pablo';

export interface MilestoneDef {
  id: MilestoneId;
  label: string;
  /** Target window in active play seconds, from GAME_DESIGN section 7. Null when the target is only an order. */
  target: { min: number; max: number } | null;
  /** How the target reads in the table. */
  targetText: string;
  reached: (state: GameState, context: MilestoneContext) => boolean;
}

export interface MilestoneContext {
  /** Skins owned in a new game (the defaults). */
  initialSkins: number;
  /** Diplomas a graduation would give right now. */
  pendingDiplomas: number;
}

const MIN = 60;
const HOUR = 3600;

/** The pacing goals of GAME_DESIGN section 7. */
export const MILESTONES: MilestoneDef[] = [
  {
    id: 'firstUpgrade',
    label: 'Primeiro upgrade',
    target: { min: 5, max: 15 },
    targetText: '10 s',
    reached: (state) => state.counters.levelsBought > 0 || state.counters.researchBought > 0,
  },
  {
    id: 'gladimir',
    label: 'Gladimir contratado',
    target: { min: 3.5 * MIN, max: 6.5 * MIN },
    targetText: '5 min',
    reached: (state) => state.hired.gladimir,
  },
  {
    id: 'firstSkin',
    label: 'Primeira skin por conquista',
    target: { min: 5 * MIN, max: 11 * MIN },
    targetText: '8 min',
    reached: (state, context) => Object.keys(state.skins).length > context.initialSkins,
  },
  {
    id: 'fourProfessors',
    label: '4 professores',
    target: { min: 32 * MIN, max: 58 * MIN },
    targetText: '45 min',
    reached: (state) => hiredCount(state) >= 4 || state.counters.graduations > 0,
  },
  {
    id: 'angelo',
    label: 'Angelo contratado',
    target: { min: 2 * HOUR, max: 3 * HOUR },
    targetText: '2 a 3 h',
    reached: (state) => state.hired.angelo || state.counters.graduations > 0,
  },
  {
    id: 'graduationAvailable',
    label: 'Primeiro diploma possível',
    target: { min: 2 * HOUR, max: 3 * HOUR },
    targetText: '2 a 3 h',
    reached: (state, context) => state.counters.graduations > 0 || (state.hired.angelo && context.pendingDiplomas >= 1),
  },
  {
    id: 'firstGraduation',
    label: 'Primeira formatura',
    target: { min: 2 * HOUR, max: 3.5 * HOUR },
    targetText: '2 a 3 h',
    reached: (state) => state.counters.graduations > 0,
  },
  {
    id: 'pablo',
    label: 'Pablo contratado',
    target: null,
    targetText: 'após a formatura',
    reached: (state) => state.hired.pablo,
  },
];
