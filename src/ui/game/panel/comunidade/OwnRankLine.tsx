import type { Board, Me } from '@/shared/api';
import { BOARD_INFO } from './boards';

interface OwnRankLineProps {
  me: Me | null;
  board: Board;
  /** The player's position on this board, or null/undefined when unknown or unranked. */
  rank: number | null | undefined;
}

/** Pinned under the list when the player's own row is not in it: where they stand, or why they do not. */
export function OwnRankLine({ me, board, rank }: OwnRankLineProps) {
  const label = BOARD_INFO.find((info) => info.board === board)?.label ?? '';

  if (!me) {
    return (
      <div className="community-own" data-qa="community-own">
        <p>Jogue um pouco e o servidor passa a acompanhar seu progresso.</p>
      </div>
    );
  }
  if (!me.nickname) return null; // the guest notice at the top of the ranking already says how to join
  if (!me.ranked || rank == null) {
    return (
      <div className="community-own" data-qa="community-own">
        <p>{me.unrankedReason ?? 'Você ainda não entrou neste ranking.'}</p>
      </div>
    );
  }
  return (
    <div className="community-own" data-qa="community-own" data-ranked="true">
      <span className="community-rank">{rank}º</span>
      <p>
        <strong>{me.nickname}</strong>, você está em {rank}º lugar em {label}.
      </p>
    </div>
  );
}
