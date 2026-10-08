'use client';

import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { FxLayer } from '@/ui/fx';
import { HackathonInviteWatcher } from '@/ui/hackathon/arena/HackathonInviteWatcher';
import { HackathonScreen } from '@/ui/hackathon/screen/HackathonScreen';
import { useHackathon } from '@/ui/hackathon/store';
import { ToastStack } from '@/ui/kit';
import { CloudRoot } from './cloud/CloudRoot';
import { MomentsHost } from './moments/MomentsHost';
import { useUi } from './shared/uiStore';
import { SidePanel } from './panel/SidePanel';
import { LoadingScreen } from './stage/LoadingScreen';
import { Stage } from './stage/Stage';
import { GameEffects } from './wiring/GameEffects';
import { ThemedRoot } from './wiring/ThemedRoot';

function GameScreen() {
  const hackathon = useHackathon((store) => store.mode === 'hackathon');
  const panelOpen = useUi((store) => store.panelOpen);
  return (
    <>
      {/* The Hackathon takes the whole screen; the classroom splits it between stage and panel. */}
      <main className="game" data-mode={hackathon ? 'hackathon' : 'classroom'} data-panel={panelOpen ? 'open' : 'closed'} data-shake-root>
        <div className="game-stage">{hackathon ? <HackathonScreen /> : <Stage />}</div>
        {hackathon || !panelOpen ? null : (
          <div className="game-panel">
            <SidePanel />
          </div>
        )}
      </main>
      {/* Outside the shaking root: effects, notifications and ceremonies must not shake with the screen. */}
      <FxLayer />
      <ToastStack />
      <MomentsHost />
      <GameEffects />
      <CloudRoot />
      <HackathonInviteWatcher />
    </>
  );
}

/** Root of the game screen: boots the store, themes everything and lays out stage and panel. */
export function GameApp() {
  const ready = useGame((store) => store.ready);

  useEffect(() => {
    useGame.getState().boot();
    return () => useGame.getState().shutdown();
  }, []);

  return <ThemedRoot>{ready ? <GameScreen /> : <LoadingScreen />}</ThemedRoot>;
}
