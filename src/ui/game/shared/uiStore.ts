import { create } from 'zustand';
import type { ProfessorId } from '@/game/content/types';

export type PanelTab = 'aulas' | 'pesquisas' | 'album' | 'formatura' | 'config';
export type AlbumSection = 'skins' | 'cenarios' | 'temas' | 'conquistas';

/**
 * Interface-only state shared by the stage and the side panel (which tab is open,
 * whose tree is on screen). Nothing here is saved or affects the game rules.
 */
interface UiStore {
  tab: PanelTab;
  albumSection: AlbumSection;
  /** Professor whose tree the Aulas tab shows. null follows the professor on stage. */
  treeProfessor: ProfessorId | null;
  setTab(tab: PanelTab): void;
  openAlbum(section: AlbumSection): void;
  setTreeProfessor(professor: ProfessorId | null): void;
}

export const useUi = create<UiStore>((set) => ({
  tab: 'aulas',
  albumSection: 'skins',
  treeProfessor: null,
  setTab: (tab) => set({ tab }),
  openAlbum: (albumSection) => set({ tab: 'album', albumSection }),
  setTreeProfessor: (treeProfessor) => set({ treeProfessor }),
}));
