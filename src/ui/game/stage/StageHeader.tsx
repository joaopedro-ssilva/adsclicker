'use client';
import { memo } from 'react';
import { useGame, useGameState } from '@/game/store';
import { ModeSwitch } from '@/ui/hackathon/arena/ModeSwitch';
import { IconButton } from '@/ui/kit';
import { useUi } from '../shared/uiStore';
import { Balance } from './Balance';
import { Logo } from './Logo';

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
  return <IconButton icon="settings" label="Abrir as configurações" variant="secondary" size="sm" onClick={() => setTab('config')} />;
}

/** Hides the side panel so the scenery takes the whole screen, and brings it back. */
function PanelToggle() {
  const open = useUi((store) => store.panelOpen);
  const togglePanel = useUi((store) => store.togglePanel);
  return (
    <IconButton
      icon={open ? 'image' : 'book'}
      label={open ? 'Esconder o painel e ver o cenário inteiro' : 'Mostrar o painel'}
      variant="secondary"
      size="sm"
      aria-pressed={!open}
      data-qa="panel-toggle"
      onClick={togglePanel}
    />
  );
}

/** Logo and tools on the edges, the mode switch in the middle and the ADScoin balance below them on wide stages. */
export const StageHeader = memo(function StageHeader() {
  return (
    <header className="stage-head">
      <Logo />
      <ModeSwitch />
      <Balance />
      <div className="stage-tools">
        <SoundToggle />
        <SettingsShortcut />
        <PanelToggle />
      </div>
    </header>
  );
});
