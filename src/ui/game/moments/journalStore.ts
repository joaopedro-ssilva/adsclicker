import { create } from 'zustand';

/**
 * The "Jornal do Campus": the window that lists every patch of the game. It opens by itself once for each new
 * patch and from the newspaper button on the stage. Interface state only: nothing here is saved with the game.
 */
interface JournalStore {
  open: boolean;
  /** A patch the player has not read yet: the stage button shows a dot. */
  unread: boolean;
  show(): void;
  close(): void;
  setUnread(unread: boolean): void;
}

export const useJournal = create<JournalStore>((set) => ({
  open: false,
  unread: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
  setUnread: (unread) => set({ unread }),
}));
