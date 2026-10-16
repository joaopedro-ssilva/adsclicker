import { create } from 'zustand';

export type LabTab = 'pesquisa' | 'progressao' | 'ranking';

/**
 * Interface-only state of the Laboratório: whether its full-screen overlay is up, the tab it shows, the shop panel and the
 * confirmation to unlock it. The game's own `lab.open` flag (what makes the run advance) follows `shown` in LabOverlay.
 */
interface LabOverlayStore {
  shown: boolean;
  tab: LabTab;
  /** The "Loja do Laboratório" panel (a placeholder for now). */
  shopOpen: boolean;
  /** The "spend 100 diplomas?" confirmation. */
  unlockAsk: boolean;
  show(tab?: LabTab): void;
  hide(): void;
  setTab(tab: LabTab): void;
  openShop(): void;
  closeShop(): void;
  askUnlock(): void;
  closeUnlock(): void;
}

export const useLabOverlay = create<LabOverlayStore>((set) => ({
  shown: false,
  tab: 'pesquisa',
  shopOpen: false,
  unlockAsk: false,
  show: (tab) => set((state) => ({ shown: true, tab: tab ?? state.tab })),
  hide: () => set({ shown: false, shopOpen: false }),
  setTab: (tab) => set({ tab }),
  openShop: () => set({ shopOpen: true }),
  closeShop: () => set({ shopOpen: false }),
  askUnlock: () => set({ unlockAsk: true }),
  closeUnlock: () => set({ unlockAsk: false }),
}));
