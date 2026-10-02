'use client';
import { useCloud } from '@/game/cloud';
import type { RunState } from '@/hackathon/engine';
import { Character } from '@/ui/art/Character';
import { useHackathon } from '../store';
import { HpBar } from './HpBar';
import { studentSprite } from './studentSprite';

interface PlayerActorProps {
  player: RunState['player'];
  tick: number;
  scale: number;
}

/** The student on the left of the arena, with their health bar and whatever status they are under. */
export function PlayerActor({ player, tick, scale }: PlayerActorProps) {
  const profile = useHackathon((store) => store.profile);
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  if (!profile) return null;
  const name = nickname ?? 'Aluno';
  const blocking = player.blockUntil > tick;
  const hasted = player.hasteUntil > tick;

  return (
    <div className="ar-player" data-player data-flow-ready={player.flowReady} data-stunned={player.stunned}>
      <div className="ar-player-info" style={{ width: Math.max(96, 48 * scale) }}>
        <p className="ar-player-name">{name}</p>
        <HpBar hp={player.hp} maxHp={player.maxHp} tone="player" numbers label="Sua vida" />
        <p className="ar-status" aria-live="polite">
          {player.stunned ? <b data-kind="stun">ATORDOADO</b> : null}
          {blocking ? <b data-kind="block">🛡️ Bloqueio</b> : null}
          {hasted ? <b data-kind="haste">⚡ Rápido</b> : null}
          {player.flowReady ? <b data-kind="flow">✨ Crítico!</b> : null}
        </p>
      </div>
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
