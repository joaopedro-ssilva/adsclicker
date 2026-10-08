'use client';
import { useCloud } from '@/game/cloud';
import type { RunState } from '@/hackathon/engine';
import { Card } from '../screen/Card';
import { HpBar } from './HpBar';

interface PlayerPanelProps {
  player: RunState['player'];
  tick: number;
}

/** The student's health under the top bar: name, bar, numbers, a mark when low, and whatever status they are under. */
export function PlayerPanel({ player, tick }: PlayerPanelProps) {
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const blocking = player.blockUntil > tick;
  const hasted = player.hasteUntil > tick;
  const low = player.maxHp > 0 && player.hp / player.maxHp <= 0.3;

  return (
    <Card className="ar-panel ar-panel-player" qa="ar-player-panel">
      <div className="ar-panel-head">
        <p className="ar-panel-name">{nickname ?? 'Aluno'}</p>
        {low ? (
          <span className="ar-panel-warn" role="img" aria-label="Vida baixa">
            ⚠
          </span>
        ) : null}
        <p className="ar-status" aria-live="polite">
          {player.stunned ? <b data-kind="stun">Atordoado</b> : null}
          {blocking ? <b data-kind="block">Bloqueio</b> : null}
          {hasted ? <b data-kind="haste">Rápido</b> : null}
          {player.flowReady ? <b data-kind="flow">Crítico</b> : null}
        </p>
      </div>
      <div className="ar-panel-row">
        <span className="ar-heart" aria-hidden="true">
          ♥
        </span>
        <HpBar hp={player.hp} maxHp={player.maxHp} tone="player" label="Sua vida" />
        <p className="ar-panel-hp">
          {Math.ceil(player.hp)} / {Math.round(player.maxHp)}
        </p>
      </div>
    </Card>
  );
}
