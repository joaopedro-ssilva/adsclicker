'use client';

import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { FxLayer } from '@/ui/fx';
import { HackathonInviteWatcher } from '@/ui/hackathon/arena/HackathonInviteWatcher';
import { HackathonStage } from '@/ui/hackathon/arena/HackathonStage';
import { HackathonPanel } from '@/ui/hackathon/panel/HackathonPanel';
import { useHackathon } from '@/ui/hackathon/store';
import { ToastStack } from '@/ui/kit';
import { CloudRoot } from './cloud/CloudRoot';
import { MomentsHost } from './moments/MomentsHost';
import { SidePanel } from './panel/SidePanel';
import { LoadingScreen } from './stage/LoadingScreen';
import { Stage } from './stage/Stage';
import { GameEffects } from './wiring/GameEffects';
import { ThemedRoot } from './wiring/ThemedRoot';

function GameScreen() {
  const hackathon = useHackathon((store) => store.mode === 'hackathon');
  return (
    <>
      <main className="game" data-shake-root>
        <div className="game-stage">
          {hackathon ? <HackathonStage /> : <Stage />}
        </div>
        <div className="game-panel">
          {hackathon ? <HackathonPanel /> : <SidePanel />}
        </div>
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
