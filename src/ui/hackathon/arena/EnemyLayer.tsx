'use client';
import type { RunState } from '@/hackathon/engine';
import { EnemyActor } from './EnemyActor';
import { useEnemyRoster } from './useEnemyRoster';

interface EnemyLayerProps {
  state: RunState;
  scale: number;
}

/** The enemy zone: every enemy of the wave in its place, defeated ones fading out. */
export function EnemyLayer({ state, scale }: EnemyLayerProps) {
  const roster = useEnemyRoster(state.enemies, state.wave);
  const covered = state.player.blockUntil > state.tick;

  return (
    <div className="ar-enemies">
      {roster.entries.map((entry) => (
        <EnemyActor
          key={entry.enemy.uid}
          entry={entry}
          groupSize={roster.groupSize}
          scale={scale}
          tick={state.tick}
          covered={covered}
        />
      ))}
    </div>
  );
}
