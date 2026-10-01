export interface ToastOptions {
  title: string;
  description?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  /** Shown instead of the tone icon, for example the emoji of an achievement. */
  emoji?: string;
  /** Milliseconds on screen. 0 keeps it until dismissed. Default 4500. */
  duration?: number;
}

export interface ToastItem extends ToastOptions {
  id: number;
}

const MAX_VISIBLE = 5;
const NO_ITEMS: ToastItem[] = [];
const DEFAULT_DURATION = 4500;

let items: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const publish = () => listeners.forEach((listener) => listener());

function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  publish();
}

function clear() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  items = [];
  publish();
}

function show(options: ToastOptions | string): number {
  const id = ++nextId;
  const item: ToastItem = { ...(typeof options === 'string' ? { title: options } : options), id };
  const oldest = items[0];
  if (items.length >= MAX_VISIBLE && oldest) dismiss(oldest.id);
  items = [...items, item];
  publish();
  const duration = item.duration ?? DEFAULT_DURATION;
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration));
  return id;
}

/** Imperative API: toast('Texto') or toast({ title, description, tone }). Needs one ToastStack mounted. */
export const toast = Object.assign(show, { dismiss, clear });

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => items,
  getServerSnapshot: (): ToastItem[] => NO_ITEMS,
};
