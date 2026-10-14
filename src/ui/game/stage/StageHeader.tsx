'use client';
import { memo, useEffect, useState } from 'react';
import { useGame, useGameState } from '@/game/store';
import { ModeSwitch } from '@/ui/hackathon/arena/ModeSwitch';
import { IconButton } from '@/ui/kit';
import { useJournal } from '../moments/journalStore';
import { useUi } from '../shared/uiStore';
import { Balance } from './Balance';
import { Logo } from './Logo';
import { shortcutKey } from './shortcutList';
import type { ShortcutId } from './shortcutList';

/** The tooltip of a tool: its name and, for the ones with a key, the key. */
const withKey = (label: string, id: ShortcutId) => `${label} (${shortcutKey(id)})`;

export function SoundToggle() {
  const muted = useGameState((state) => state.settings.muted);
  const updateSettings = useGame((store) => store.updateSettings);
  return (
    <IconButton
      icon={muted ? 'soundOff' : 'soundOn'}
      label={muted ? 'Ligar o som' : 'Silenciar o som'}
      variant="secondary"
      size="sm"
      aria-pressed={muted}
      onClick={() => updateSettings({ muted: !muted })}
    />
  );
}

function SettingsShortcut() {
  const setTab = useUi((store) => store.setTab);
  return <IconButton icon="settings" label="Abrir as configurações" title={withKey('Configurações', 'tab-config')} variant="secondary" size="sm" onClick={() => setTab('config')} />;
}

/** Hides the side panel so the scenery takes the whole screen, and brings it back. */
function PanelToggle() {
  const open = useUi((store) => store.panelOpen);
  const togglePanel = useUi((store) => store.togglePanel);
  return (
    <IconButton
      icon={open ? 'image' : 'book'}
      label={open ? 'Esconder o painel e ver o cenário inteiro' : 'Mostrar o painel'}
      title={withKey(open ? 'Esconder o painel' : 'Mostrar o painel', 'panel')}
      variant="secondary"
      size="sm"
      aria-pressed={!open}
      data-qa="panel-toggle"
      onClick={togglePanel}
    />
  );
}

/** Photo mode: everything goes away but the professor and the scenery. */
function PhotoToggle() {
  const setPhoto = useUi((store) => store.setPhoto);
  return (
    <IconButton
      icon="eye"
      label="Modo foto: só o professor e o cenário"
      title={withKey('Modo foto', 'photo')}
      variant="secondary"
      size="sm"
      data-qa="photo-toggle"
      onClick={() => setPhoto(true)}
    />
  );
}

/** Opens the Jornal do Campus; a dot says there is a patch the player has not read. */
function JournalButton() {
  const unread = useJournal((store) => store.unread);
  return (
    <span className="tool-wrap">
      <IconButton
        icon="news"
        label={unread ? 'Abrir o Jornal do Campus (há novidade)' : 'Abrir o Jornal do Campus'}
        title={withKey('Jornal do Campus', 'journal')}
        variant="secondary"
        size="sm"
        data-qa="journal-button"
        onClick={() => useJournal.getState().show()}
      />
      {unread ? <i className="tool-dot" aria-hidden="true" data-qa="journal-dot" /> : null}
    </span>
  );
}

/**
 * The five tools. On a wide stage they are one row. On a narrow one (phones) only the sound and a "mais" button
 * show, so the group stays two buttons tall; "mais" opens the rest in a row beside it.
 */
function Tools() {
  const [open, setOpen] = useState(false);
  const unread = useJournal((store) => store.unread);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && (event.target as Element | null)?.closest?.('.stage-tools')) return;
      setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [open]);

  return (
    <div className="stage-tools" data-open={open} role="group" aria-label="Ferramentas">
      <SoundToggle />
      <span className="tool-wrap tools-more">
        <IconButton
          icon="plus"
          label={open ? 'Fechar as outras ferramentas' : 'Mais ferramentas'}
          variant="secondary"
          size="sm"
          aria-pressed={open}
          aria-expanded={open}
          data-qa="tools-more"
          onClick={() => setOpen((value) => !value)}
        />
        {unread && !open ? <i className="tool-dot" aria-hidden="true" /> : null}
      </span>
      {/* One tap on any of them closes the row again. */}
      <div className="tools-extra" onClick={() => setOpen(false)}>
        <SettingsShortcut />
        <PanelToggle />
        <PhotoToggle />
        <JournalButton />
      </div>
    </div>
  );
}

/** Logo and tools on the edges, the mode switch in the middle and the ADScoin balance below them on wide stages. */
export const StageHeader = memo(function StageHeader() {
  return (
    <header className="stage-head">
      <Logo />
      <ModeSwitch />
      <Balance />
      <Tools />
    </header>
  );
});
