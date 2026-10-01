'use client';

import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { FxLayer } from '@/ui/fx';
import { ToastStack } from '@/ui/kit';
import { MomentsHost } from './moments/MomentsHost';
import { SidePanel } from './panel/SidePanel';
import { LoadingScreen } from './stage/LoadingScreen';
import { Stage } from './stage/Stage';
import { GameEffects } from './wiring/GameEffects';
import { ThemedRoot } from './wiring/ThemedRoot';

function GameScreen() {
  return (
    <>
      <main className="game" data-shake-root>
        <div className="game-stage">
          <Stage />
        </div>
        <div className="game-panel">
          <SidePanel />
        </div>
      </main>
      {/* Outside the shaking root: effects, notifications and ceremonies must not shake with the screen. */}
      <FxLayer />
      <ToastStack />
      <MomentsHost />
      <GameEffects />
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
