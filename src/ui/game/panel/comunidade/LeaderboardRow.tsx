import { formatNumber } from '@/game/engine/format';
import type { LeaderboardEntry } from '@/shared/api';
import { PlayerAvatar } from './PlayerAvatar';
import { TagBadge } from './TagBadge';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  own: boolean;
  /** Opens the player's profile. The nickname is the button; its hit area covers the whole row. */
  onOpen?: (nickname: string) => void;
}

/** One ranking line. Plain markup (no tooltip, no animation) so a hundred of them stay cheap. */
export function LeaderboardRow({ entry, own, onOpen }: LeaderboardRowProps) {
  const podium = entry.rank <= 3 ? entry.rank : 0;
  return (
    <li className="community-row" data-podium={podium || undefined} data-own={own || undefined} data-clickable={onOpen ? true : undefined}>
      <span className="community-rank">{entry.rank}º</span>
      <PlayerAvatar professor={entry.professor} skin={entry.skin} />
      <span className="community-name">
        <span className="community-nick" title={entry.nickname}>
          {onOpen ? (
            <button
              type="button"
              className="community-open"
              aria-label={`Ver o perfil de ${entry.nickname}`}
              data-qa="community-open-profile"
              onClick={() => onOpen(entry.nickname)}
            >
              {entry.nickname}
            </button>
          ) : (
            entry.nickname
          )}
          <TagBadge tags={entry.tags} />
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
