import { create } from 'zustand';

export type PanelTab = 'aulas' | 'pesquisas' | 'album' | 'formatura' | 'comunidade' | 'config';
export type AlbumSection = 'skins' | 'cenarios' | 'temas' | 'conquistas';

/**
 * Interface-only state shared by the stage and the side panel (which tab is open, whether the panel shows).
 * Nothing here is saved or affects the game rules.
 */
interface UiStore {
  tab: PanelTab;
  albumSection: AlbumSection;
  /** False while the player hid the panel to see the whole scenery. Opening a tab shows it again. */
  panelOpen: boolean;
  /** Photo mode: only the professor and the scenery are on screen. */
  photo: boolean;
  setTab(tab: PanelTab): void;
  togglePanel(): void;
  openAlbum(section: AlbumSection): void;
  setPhoto(photo: boolean): void;
  togglePhoto(): void;
}

export const useUi = create<UiStore>((set) => ({
  tab: 'aulas',
  albumSection: 'skins',
  panelOpen: true,
  photo: false,
  setTab: (tab) => set({ tab, panelOpen: true }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  openAlbum: (albumSection) => set({ tab: 'album', albumSection, panelOpen: true }),
  setPhoto: (photo) => set({ photo }),
  togglePhoto: () => set((state) => ({ photo: !state.photo })),
}));
