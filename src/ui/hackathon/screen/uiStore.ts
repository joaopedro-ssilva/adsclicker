import { create } from 'zustand';

export type HackathonTab = 'aluno' | 'itens' | 'habilidades' | 'mentores' | 'fases';

/** Interface-only state of the Hackathon screen: which tab is open and what the player last picked there. */
interface HackathonUi {
  tab: HackathonTab;
  /** An item the items tab should open on (set by the equipment slots of the hub). */
  focusItem: string | null;
  /** Start fights in automatic mode (skills fire alone at 80%). Shared by every start button. */
  auto: boolean;
  setTab(tab: HackathonTab): void;
  openItem(id: string): void;
  setAuto(auto: boolean): void;
}

export const useHackathonUi = create<HackathonUi>((set) => ({
  tab: 'aluno',
  focusItem: null,
  auto: false,
  setTab: (tab) => set({ tab, focusItem: null }),
  openItem: (focusItem) => set({ tab: 'itens', focusItem }),
  setAuto: (auto) => set({ auto }),
}));
