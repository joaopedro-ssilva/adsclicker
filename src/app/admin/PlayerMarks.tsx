import { formatNumber } from '@/game/engine/format';
import type { AdminPlayer } from '@/shared/api';
import { Badge } from '@/ui/kit';

/** The state badges of a player row: this browser, test account, suspect (with the reason) and banned. */
export function PlayerMarks({ player }: { player: AdminPlayer }) {
  const hasMarks = player.self || player.testAccount || player.flagged || player.banned || player.multiplier !== 1;
  if (!hasMarks) return <span className="muted">-</span>;
  return (
    <span className="admin-marks">
      {player.self ? <Badge tone="accent">Você</Badge> : null}
      {player.testAccount ? (
        <Badge tone="warn">Teste{player.multiplier !== 1 ? ` ×${formatNumber(player.multiplier)}` : ''}</Badge>
      ) : player.multiplier !== 1 ? (
        <Badge tone="warn">×{formatNumber(player.multiplier)}</Badge>
      ) : null}
      {player.flagged ? (
        <Badge tone="bad" title={player.flagReason ?? undefined}>
          Suspeito
        </Badge>
      ) : null}
      {player.banned ? <Badge tone="bad">Banido</Badge> : null}
      {player.flagged && player.flagReason ? <span className="admin-flag-reason">{player.flagReason}</span> : null}
    </span>
  );
}
