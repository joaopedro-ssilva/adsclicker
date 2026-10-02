'use client';
import { memo } from 'react';
import { useGame, useGameState } from '@/game/store';
import { CompactBalance } from '@/ui/hackathon/arena/CompactBalance';
import { ModeSwitch } from '@/ui/hackathon/arena/ModeSwitch';
import { useHackathon } from '@/ui/hackathon/store';
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

/**
 * Logo and tools on the edges, the mode switch in the middle and the ADScoin balance below them on wide stages.
 * In the Hackathon the balance shrinks to a pill: the classroom keeps producing underneath.
 */
export const StageHeader = memo(function StageHeader() {
  const hackathon = useHackathon((store) => store.mode === 'hackathon');
  return (
    <header className="stage-head" data-mode={hackathon ? 'hackathon' : 'classroom'}>
      <Logo />
      <ModeSwitch />
      {hackathon ? <CompactBalance /> : <Balance />}
      <div className="stage-tools">
        <SoundToggle />
        <SettingsShortcut />
      </div>
    </header>
  );
});
