import { formatNumber } from '@/game/engine/format';
import type { LeaderboardEntry } from '@/shared/api';
import { PlayerAvatar } from './PlayerAvatar';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  own: boolean;
}

/** One ranking line. Plain markup (no tooltip, no animation) so a hundred of them stay cheap. */
export function LeaderboardRow({ entry, own }: LeaderboardRowProps) {
  const podium = entry.rank <= 3 ? entry.rank : 0;
  return (
    <li className="community-row" data-podium={podium || undefined} data-own={own || undefined}>
      <span className="community-rank">{entry.rank}º</span>
      <PlayerAvatar professor={entry.professor} skin={entry.skin} />
      <span className="community-name">
        <span className="community-nick">
          {entry.nickname}
          {own ? <span className="community-you">você</span> : null}
        </span>
        <span className="community-sub">
          {entry.online ? <span className="community-dot" data-on="true" role="img" aria-label="online" /> : null}
          {formatNumber(entry.diplomas, { integer: true })} diplomas · {formatNumber(entry.achievements, { integer: true })}{' '}
          conquistas
        </span>
      </span>
      <span className="community-value">{formatNumber(entry.value, { integer: true })}</span>
    </li>
  );
}
