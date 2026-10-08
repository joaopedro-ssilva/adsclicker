'use client';
import { useCloud } from '@/game/cloud';
import type { RunState } from '@/hackathon/engine';
import { Character } from '@/ui/art/Character';
import { useHackathon } from '../store';
import { studentSprite } from './studentSprite';

interface PlayerActorProps {
  player: RunState['player'];
  tick: number;
  scale: number;
}

/** The student on the left of the field, with the marks of being stunned or blocking. Health lives in the panel. */
export function PlayerActor({ player, tick, scale }: PlayerActorProps) {
  const profile = useHackathon((store) => store.profile);
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  if (!profile) return null;
  const name = nickname ?? 'Aluno';
  const blocking = player.blockUntil > tick;

  return (
    <div className="ar-player" data-player data-flow-ready={player.flowReady} data-stunned={player.stunned}>
      <div className="ar-player-body">
        {player.stunned ? (
          <span className="ar-stars" aria-hidden="true">
            <i>⭐</i>
            <i>⭐</i>
            <i>⭐</i>
          </span>
        ) : null}
        {blocking ? <span className="ar-shield" aria-hidden="true" /> : null}
        <Character {...studentSprite(profile.head, profile.cargo, name)} scale={scale} label={name} />
      </div>
    </div>
  );
}
