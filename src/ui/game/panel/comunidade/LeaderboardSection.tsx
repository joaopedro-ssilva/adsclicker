import { useState } from 'react';
import type { Board, LeaderboardResponse, Me } from '@/shared/api';
import { Button, EmptyState, Icon } from '@/ui/kit';
import { Section } from '../lib/Section';
import { BOARD_INFO } from './boards';
import { LeaderboardRow } from './LeaderboardRow';
import { OwnRankLine } from './OwnRankLine';

/** Rows shown before "ver mais": a hundred rows at once would push the feed far down the tab. */
const PAGE = 10;

interface LeaderboardSectionProps {
  board: Board;
  onBoard: (board: Board) => void;
  data: LeaderboardResponse | undefined;
  loading: boolean;
  me: Me | null;
  ranks: Partial<Record<Board, number | null>> | null;
}

export function LeaderboardSection({ board, onBoard, data, loading, me, ranks }: LeaderboardSectionProps) {
  const [shown, setShown] = useState<{ board: Board; count: number }>({ board, count: PAGE });
  const count = shown.board === board ? shown.count : PAGE;

  const ownNick = me?.ranked && me.nickname ? me.nickname.toLowerCase() : null;
  const entries = data?.entries ?? [];
  const isOwn = (nickname: string) => nickname.toLowerCase() === ownNick;
  const ownInList = ownNick !== null && entries.some((entry) => isOwn(entry.nickname));
  const visible = entries.slice(0, count);
  const ownHidden = ownInList && !visible.some((entry) => isOwn(entry.nickname));

  return (
    <Section title="Ranking" note={entries.length > 0 ? `Top ${entries.length}` : undefined}>
      <div className="community-boards" role="group" aria-label="Ranking por">
        {BOARD_INFO.map((item) => (
          <Button
            key={item.board}
            size="sm"
            variant="secondary"
            aria-pressed={board === item.board}
            data-qa={`community-board-${item.board}`}
            onClick={() => onBoard(item.board)}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <ul className="community-list" aria-busy="true" aria-label="Carregando ranking">
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="community-row community-skeleton" />
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <EmptyState title="Ninguém no ranking ainda" icon="trophy">
          Escolha um apelido e seja o primeiro da turma a aparecer aqui.
        </EmptyState>
      ) : (
        <>
          <ul className="community-list" data-qa="community-list">
            {visible.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} own={isOwn(entry.nickname)} />
            ))}
          </ul>
          {entries.length > count ? (
            <Button
              variant="ghost"
              size="sm"
              className="community-more"
              data-qa="community-more"
              onClick={() => setShown({ board, count: count + PAGE * 2 })}
            >
              Ver mais ({entries.length - count})
            </Button>
          ) : null}
          {ownHidden ? <p className="community-note">Você está na lista, mais abaixo: toque em &quot;ver mais&quot;.</p> : null}
        </>
      )}

      {!ownInList ? <OwnRankLine me={me} board={board} rank={ranks?.[board]} /> : null}
    </Section>
  );
}
