'use client';

import { SidePanel } from './panel/SidePanel';
import { Stage } from './stage/Stage';

/** Root of the game screen. Placeholder: the stage engineer owns and replaces this file. */
export function GameApp() {
  return (
    <main className="game" data-shake-root>
      <Stage />
      <SidePanel />
    </main>
  );
}
