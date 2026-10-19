import { create } from 'zustand';

export type LabTab = 'pesquisa' | 'progressao' | 'ranking' | 'cosmeticos';

/**
 * Interface-only state of the Laboratório: whether its full-screen overlay is up, the tab it shows, the shop panel and the
 * confirmation to unlock it. The game's own `lab.open` flag (what makes the run advance) follows `shown` in LabOverlay.
 */
interface LabOverlayStore {
  shown: boolean;
  tab: LabTab;
  /** The "Loja do Laboratório" panel. */
  shopOpen: boolean;
  /** The "spend 30 diplomas?" confirmation. */
  unlockAsk: boolean;
  /** Sections of the Cosméticos tab the player folded (kept for the session). */
  folded: Record<string, true>;
  toggleFold(id: string): void;
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
  folded: {},
  toggleFold: (id) =>
    set((state) => {
      const folded = { ...state.folded };
      if (folded[id]) delete folded[id];
      else folded[id] = true;
      return { folded };
    }),
  show: (tab) => set((state) => ({ shown: true, tab: tab ?? state.tab })),
  hide: () => set({ shown: false, shopOpen: false }),
  setTab: (tab) => set({ tab }),
  openShop: () => set({ shopOpen: true }),
  closeShop: () => set({ shopOpen: false }),
  askUnlock: () => set({ unlockAsk: true }),
  closeUnlock: () => set({ unlockAsk: false }),
}));
