import { joinhaView, maestriasView, rollforwardView, swarmView } from '../engine/views';
import type { JoinhaView, MaestriasView, RollforwardView, SwarmView } from '../engine/views';
import { useGameView } from './hooks';

/** The eight Maestria cards and the slots, for the Formatura tab. */
export const useMaestriasView = (): MaestriasView => useGameView(maestriasView);
/** Joinha de Ouro's counter; null while Edécio's Maestria is not unlocked. */
export const useJoinhaView = (): JoinhaView | null => useGameView(joinhaView);
export const useRollforwardView = (): RollforwardView | null => useGameView(rollforwardView);
export const useSwarmView = (): SwarmView | null => useGameView(swarmView);
