import { create } from 'zustand';

export type LabTab = 'pesquisa' | 'arvore' | 'registro';

/**
 * Interface-only state of the Laboratório: whether its full-screen overlay is up, the tab it shows, and the
 * confirmation to unlock it. The game's own `lab.open` flag (what makes the run advance) follows `shown` in LabOverlay.
 */
interface LabOverlayStore {
  shown: boolean;
  tab: LabTab;
  /** The "spend 100 diplomas?" confirmation. */
  unlockAsk: boolean;
  show(tab?: LabTab): void;
  hide(): void;
  setTab(tab: LabTab): void;
  askUnlock(): void;
  closeUnlock(): void;
}

export const useLabOverlay = create<LabOverlayStore>((set) => ({
  shown: false,
  tab: 'pesquisa',
  unlockAsk: false,
  show: (tab) => set((state) => ({ shown: true, tab: tab ?? state.tab })),
  hide: () => set({ shown: false }),
  setTab: (tab) => set({ tab }),
  askUnlock: () => set({ unlockAsk: true }),
  closeUnlock: () => set({ unlockAsk: false }),
}));
