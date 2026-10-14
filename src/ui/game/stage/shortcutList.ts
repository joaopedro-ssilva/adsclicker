import type { PanelTab } from '../shared/uiStore';

export type ShortcutId =
  | 'ability-1'
  | 'ability-2'
  | 'ability-3'
  | 'ability-4'
  | 'rollforward'
  | 'swarm'
  | 'festa'
  | 'bolsa'
  | 'panel'
  | 'photo'
  | 'journal'
  | 'leave-photo'
  | `tab-${PanelTab}`;

export interface Shortcut {
  id: ShortcutId;
  /** What the player presses, as the keycap shows it: a letter, a digit, "Shift+1" or "Esc". */
  key: string;
  /** What it does, in Portuguese. */
  label: string;
  group: 'Habilidades' | 'Maestrias' | 'Tela' | 'Painel';
}

/**
 * Keyboard shortcuts of the classroom (desktop). One list for everything: the host that listens, the keycaps on
 * the buttons and, later, the Config tab. They never fire while typing, with a window open or with Ctrl, Alt or Meta held.
 */
export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'ability-1', key: '1', label: 'Primeira habilidade', group: 'Habilidades' },
  { id: 'ability-2', key: '2', label: 'Segunda habilidade', group: 'Habilidades' },
  { id: 'ability-3', key: '3', label: 'Terceira habilidade', group: 'Habilidades' },
  { id: 'ability-4', key: '4', label: 'Quarta habilidade', group: 'Habilidades' },
  { id: 'rollforward', key: 'R', label: 'Rollforward', group: 'Maestrias' },
  { id: 'swarm', key: 'I', label: 'Super invasão', group: 'Maestrias' },
  { id: 'festa', key: 'F', label: 'Festa de lançamento', group: 'Maestrias' },
  { id: 'bolsa', key: 'B', label: 'Abrir a Bolsa de tokens', group: 'Maestrias' },
  { id: 'panel', key: 'P', label: 'Esconder ou mostrar o painel', group: 'Tela' },
  { id: 'photo', key: 'C', label: 'Modo foto', group: 'Tela' },
  { id: 'leave-photo', key: 'Esc', label: 'Sair do modo foto', group: 'Tela' },
  { id: 'journal', key: 'J', label: 'Jornal do Campus', group: 'Tela' },
  { id: 'tab-aulas', key: 'Shift+1', label: 'Aba Aulas', group: 'Painel' },
  { id: 'tab-pesquisas', key: 'Shift+2', label: 'Aba Pesquisas', group: 'Painel' },
  { id: 'tab-album', key: 'Shift+3', label: 'Aba Álbum', group: 'Painel' },
  { id: 'tab-formatura', key: 'Shift+4', label: 'Aba Formatura', group: 'Painel' },
  { id: 'tab-comunidade', key: 'Shift+5', label: 'Aba Turma', group: 'Painel' },
  { id: 'tab-config', key: 'Shift+6', label: 'Aba Config', group: 'Painel' },
];

const byId = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

/** The key text of a shortcut, for keycaps and tooltips. */
export function shortcutKey(id: ShortcutId): string {
  return byId.get(id)?.key ?? '';
}

/** The shortcut an event presses, or null. Letters ignore case and keyboard layout state; Shift+digit uses the physical key. */
export function matchShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>): Shortcut | null {
  for (const shortcut of SHORTCUTS) {
    const [first, second] = shortcut.key.split('+');
    if (second !== undefined) {
      if (first === 'Shift' && event.shiftKey && event.code === `Digit${second}`) return shortcut;
    } else if (shortcut.key === 'Esc') {
      if (event.key === 'Escape') return shortcut;
    } else if (!event.shiftKey && event.key.toLowerCase() === shortcut.key.toLowerCase()) {
      return shortcut;
    }
  }
  return null;
}
