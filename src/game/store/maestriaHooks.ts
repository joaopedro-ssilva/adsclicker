import { bolsaView, festaView, horasView, joinhaView, maestriasView, releasesView, rollforwardView, swarmView } from '../engine/views';
import type { BolsaView, FestaView, HorasView, JoinhaView, MaestriasView, ReleasesView, RollforwardView, SwarmView } from '../engine/views';
import { useGameView } from './hooks';

/** The eight Maestria cards and the slots, for the Formatura tab. */
export const useMaestriasView = (): MaestriasView => useGameView(maestriasView);
/** Joinha de Ouro's counter; null while Edécio's Maestria is not unlocked. */
export const useJoinhaView = (): JoinhaView | null => useGameView(joinhaView);
export const useRollforwardView = (): RollforwardView | null => useGameView(rollforwardView);
export const useSwarmView = (): SwarmView | null => useGameView(swarmView);
/** Guto's Festa de lançamento: its recharge and the party in progress. */
export const useFestaView = (): FestaView | null => useGameView(festaView);
/** B1's versions of the run. */
export const useReleasesView = (): ReleasesView | null => useGameView(releasesView);
/** Angelo's hours bar. */
export const useHorasView = (): HorasView | null => useGameView(horasView);
/** Pablo's market. */
export const useBolsaView = (): BolsaView | null => useGameView(bolsaView);
