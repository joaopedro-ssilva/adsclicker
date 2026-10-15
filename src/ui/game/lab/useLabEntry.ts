import { useShallow } from 'zustand/react/shallow';
import { labSlotView } from '@/game/engine/views';
import { content, useGame } from '@/game/store';
import { entryInfo, entryNeedsAttention } from './labFormat';
import type { LabEntryInfo } from './labFormat';
import { useLabOverlay } from './labOverlayStore';

export interface LabEntry extends LabEntryInfo {
  /** Pablo is hired: the 9th slot shows. */
  visible: boolean;
  canUnlock: boolean;
  cost: number;
  diplomas: number;
  affordable: boolean;
  bestPhase: number;
  attention: boolean;
  /** Opens the overlay, or the unlock confirmation while the Laboratório is still locked. */
  activate(): void;
}

/**
 * The 9th slot as the roster and the professor strip see it. Only primitives are selected, so the slot re-renders when
 * the run changes phase, not on every tick.
 */
export function useLabEntry(): LabEntry {
  const info = useGame(
    useShallow((store) => {
      const view = labSlotView(store.state, content);
      const run = store.state.lab.turma.run;
      return {
        ...entryInfo(view, run?.status ?? 'none', run?.phase ?? 0),
        visible: view.visible,
        canUnlock: view.canUnlock,
        cost: view.cost,
        diplomas: view.diplomas,
        affordable: view.affordable,
        bestPhase: view.bestPhase,
      };
    }),
  );
  const activate = () => {
    const overlay = useLabOverlay.getState();
    if (info.unlocked) overlay.show();
    else overlay.askUnlock();
  };
  return { ...info, attention: entryNeedsAttention(info), activate };
}
