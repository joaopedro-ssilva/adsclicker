'use client';
import { formatDuration, formatNumber } from '@/game/engine/format';
import type { AdminPlayer } from '@/shared/api';
import { Button } from '@/ui/kit';
import { relativeTime } from '@/ui/game/panel/comunidade/relativeTime';
import { PlayerActions } from './PlayerActions';
import { PlayerMarks } from './PlayerMarks';

interface PlayerRowProps {
  player: AdminPlayer;
  /** Epoch ms used for "há 5 min", fixed per list so rows agree. */
  now: number;
  open: boolean;
  onToggle: () => void;
  onChanged: (player: AdminPlayer) => void;
}

export function PlayerRow({ player, now, open, onToggle, onChanged }: PlayerRowProps) {
  return (
    <>
      <tr
        className="admin-row"
        data-self={player.self || undefined}
        data-banned={player.banned || undefined}
        data-qa="admin-player-row"
      >
        <td data-label="Jogador" className="admin-td-player">
          <span className="admin-cell-player">
            <span className="admin-dot" data-on={player.online} role="img" aria-label={player.online ? 'online' : 'offline'} />
            {player.nickname ? <strong>{player.nickname}</strong> : <em className="muted">convidado</em>}
          </span>
        </td>
        <td data-label="Último acesso">{player.online ? 'online agora' : relativeTime(player.lastSeenAt, now)}</td>
        <td data-label="Tempo de jogo">{formatDuration(player.playSeconds * 1000)}</td>
        <td data-label="ADScoins" className="admin-num">
          {formatNumber(player.lifetimeCoins)}
        </td>
        <td data-label="Diplomas" className="admin-num">
          {formatNumber(player.diplomasEarned, { integer: true })}
        </td>
        <td data-label="Conquistas" className="admin-num">
          {formatNumber(player.achievements, { integer: true })}
        </td>
        <td data-label="Marcas">
          <PlayerMarks player={player} />
        </td>
        <td className="admin-cell-action">
          <Button
            size="sm"
            variant={open ? 'primary' : 'secondary'}
            aria-expanded={open}
            data-qa="admin-manage"
            onClick={onToggle}
          >
            {open ? 'Fechar' : 'Gerenciar'}
          </Button>
        </td>
      </tr>
      {open ? (
        <tr className="admin-row-actions">
          <td colSpan={8}>
            <PlayerActions player={player} onChanged={onChanged} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
