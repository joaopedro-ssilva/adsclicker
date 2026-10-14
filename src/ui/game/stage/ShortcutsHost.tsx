'use client';
import { useEffect } from 'react';
import { abilityViews, bolsaView, festaView, hasFeature, rollforwardView, swarmView } from '@/game/engine/views';
import { content, useGame } from '@/game/store';
import { useJournal } from '../moments/journalStore';
import { useUi } from '../shared/uiStore';
import type { PanelTab } from '../shared/uiStore';
import { useBolsaPanel } from './maestria/bolsa/bolsaPanelStore';
import { matchShortcut } from './shortcutList';
import type { ShortcutId } from './shortcutList';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

/** A window (the native dialogs of the kit, the ceremonies) or the Bolsa is open: the keys belong to it. */
function windowOpen(): boolean {
  return document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') !== null || useBolsaPanel.getState().open;
}

function press(id: ShortcutId): void {
  const game = useGame.getState();
  const { state } = game;
  const now = Date.now();
  const ui = useUi.getState();

  if (id.startsWith('ability-')) {
    const slot = Number(id.slice('ability-'.length));
    // The live state: the listener is attached once, not on every tick.
    const ability = abilityViews(state, content, now).filter((view) => view.unlocked)[slot - 1];
    if (ability && ability.cooldownLeftMs <= 0 && ability.activeLeftMs <= 0) void game.useAbility(ability.id);
    return;
  }
  if (id.startsWith('tab-')) {
    const tab = id.slice('tab-'.length) as PanelTab;
    const available = tab !== 'formatura' || hasFeature(state, content, 'graduation') || state.diplomasEarned > 0;
    if (available && !ui.photo) ui.setTab(tab);
    return;
  }

  switch (id) {
    case 'rollforward':
      if (rollforwardView(state, content)?.ready) void game.fireRollforward();
      break;
    case 'swarm':
      if (swarmView(state, content, now)?.ready) void game.startSwarm();
      break;
    case 'festa':
      if (festaView(state, content, now)?.ready) void game.startFesta();
      break;
    case 'bolsa':
      if (bolsaView(state, content) && !ui.photo) useBolsaPanel.getState().show();
      break;
    case 'panel':
      if (!ui.photo) ui.togglePanel();
      break;
    case 'photo':
      ui.togglePhoto();
      break;
    case 'leave-photo':
      if (ui.photo) ui.setPhoto(false);
      break;
    case 'journal':
      if (!ui.photo) useJournal.getState().show();
      break;
  }
}

/** Listens for the classroom's keyboard shortcuts (see shortcutList.ts). Renders nothing. */
export function ShortcutsHost() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target) || windowOpen()) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      // Esc only means something in photo mode; elsewhere it stays free for whatever else wants it.
      if (shortcut.id === 'leave-photo' && !useUi.getState().photo) return;
      event.preventDefault();
      press(shortcut.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
