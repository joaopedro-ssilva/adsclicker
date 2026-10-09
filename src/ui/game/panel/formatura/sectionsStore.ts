import { create } from 'zustand';

/**
 * Which sections of the Formatura tab are open. Interface-only: kept on this device in localStorage, never in
 * the save and never read by the engine. Every section starts closed on a first visit.
 */
export type SectionId = 'maestrias' | 'honour' | 'monitors' | 'reset' | 'tree';

const KEY = 'adsclicker.formatura.sections';

function read(): Partial<Record<SectionId, boolean>> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<SectionId, boolean>>) : {};
  } catch {
    return {};
  }
}

function write(open: Partial<Record<SectionId, boolean>>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(open));
  } catch {
    // Private mode or blocked storage: the sections just start closed next time.
  }
}

interface SectionsStore {
  open: Partial<Record<SectionId, boolean>>;
  setOpen(id: SectionId, open: boolean): void;
}

export const useSections = create<SectionsStore>((set, get) => ({
  open: typeof window === 'undefined' ? {} : read(),
  setOpen: (id, open) => {
    const next = { ...get().open, [id]: open };
    write(next);
    set({ open: next });
  },
}));
