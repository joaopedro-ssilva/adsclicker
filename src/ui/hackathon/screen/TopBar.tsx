'use client';
import type { ReactNode } from 'react';
import { formatNumber } from '@/game/engine/format';
import { useCoins } from '@/game/store';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useUi } from '@/ui/game/shared/uiStore';
import { Logo } from '@/ui/game/stage/Logo';
import { SoundToggle } from '@/ui/game/stage/StageHeader';
import { Icon, IconButton } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { ModeSwitch } from '../arena/ModeSwitch';
import { Commits } from '../panel/lib/Commits';
import { useHackathon } from '../store';

/** Level, ADScoins (the classroom keeps producing underneath), Commits and Café: every screen spends or earns them. */
function Resources({ profile }: { profile: HackathonProfile }) {
  const coins = useCoins();
  const ratio = profile.xpToNext > 0 ? Math.min(1, profile.xp / profile.xpToNext) : 1;
  return (
    <div className="hx-resources" data-qa="hk-resources">
      <span className="hx-res hx-res-level" title="Nível do aluno" style={cssVariables({ '--fill': `${ratio * 100}%` })}>
        <span>
          Nível <b>{profile.level}</b>
        </span>
        <i aria-hidden="true" />
      </span>
      <span className="hx-res hx-res-coins" title="ADScoins" data-qa="hk-coins">
        <Icon name="coin" size={16} />
        <b>{formatNumber(coins, { integer: true })}</b>
      </span>
      <span className="hx-res" title="Commits" data-qa="hk-commits">
        <Commits amount={profile.commits} size={14} />
      </span>
      <span className="hx-res hx-res-cafe" data-empty={profile.cafe.count === 0} title="Café" data-qa="hk-cafe-count">
        <span aria-hidden="true">☕</span>
        <b>
          {profile.cafe.count}/{profile.cafe.max}
        </b>
      </span>
    </div>
  );
}

/** The settings live in the classroom panel: this goes back there with that tab open. */
function SettingsShortcut() {
  const setTab = useUi((store) => store.setTab);
  const setMode = useHackathon((store) => store.setMode);
  const fighting = useHackathon((store) => store.run !== null);
  if (fighting) return null;
  return (
    <IconButton
      icon="settings"
      label="Abrir as configurações (na sala de aula)"
      variant="secondary"
      size="sm"
      onClick={() => {
        setTab('config');
        setMode('classroom');
      }}
    />
  );
}

/** Top of the Hackathon screen: logo, whatever the state puts in the middle (tabs, or the HUD of the fight), resources and tools. */
export function TopBar({ children }: { children?: ReactNode }) {
  const profile = useHackathon((store) => store.profile);
  const fighting = useHackathon((store) => store.run !== null);
  return (
    <header className="hx-top" data-fighting={fighting}>
      <Logo />
      <div className="hx-top-center">{children}</div>
      <div className="hx-top-right">
        {profile ? <Resources profile={profile} /> : null}
        <ModeSwitch />
        <div className="hx-tools">
          <SoundToggle />
          <SettingsShortcut />
        </div>
      </div>
    </header>
  );
}
