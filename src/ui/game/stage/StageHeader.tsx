'use client';
import { memo } from 'react';
import { useGame, useGameState } from '@/game/store';
import { IconButton } from '@/ui/kit';
import { useUi } from '../shared/uiStore';
import { Balance } from './Balance';
import { Logo } from './Logo';

function SoundToggle() {
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

/** Logo and tools on the edges, the Edécoin balance in the middle (below them on wide stages). */
export const StageHeader = memo(function StageHeader() {
  return (
    <header className="stage-head">
      <Logo />
      <Balance />
      <div className="stage-tools">
        <SoundToggle />
        <SettingsShortcut />
      </div>
    </header>
  );
});
