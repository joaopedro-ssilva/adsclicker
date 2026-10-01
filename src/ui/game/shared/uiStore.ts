import { create } from 'zustand';

export type PanelTab = 'aulas' | 'pesquisas' | 'album' | 'formatura' | 'config';
export type AlbumSection = 'skins' | 'cenarios' | 'temas' | 'conquistas';

/**
 * Interface-only state shared by the stage and the side panel (which tab is open).
 * Nothing here is saved or affects the game rules.
 */
interface UiStore {
  tab: PanelTab;
  albumSection: AlbumSection;
  setTab(tab: PanelTab): void;
  openAlbum(section: AlbumSection): void;
}

export const useUi = create<UiStore>((set) => ({
  tab: 'aulas',
  albumSection: 'skins',
  setTab: (tab) => set({ tab }),
  openAlbum: (albumSection) => set({ tab: 'album', albumSection }),
}));
