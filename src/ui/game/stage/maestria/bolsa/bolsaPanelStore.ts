import { create } from 'zustand';

/** Whether the Bolsa de tokens panel is open. Interface only: the stage button and the Maestria card both open it. */
interface BolsaPanelStore {
  open: boolean;
  show(): void;
  close(): void;
}

export const useBolsaPanel = create<BolsaPanelStore>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
