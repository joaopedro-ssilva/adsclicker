'use client';
import { useState } from 'react';
import { useCloud } from '@/game/cloud';
import type { Board } from '@/shared/api';
import { EmptyState } from '@/ui/kit';
import { CommunityStats } from './CommunityStats';
import { FeedSection } from './FeedSection';
import { LeaderboardSection } from './LeaderboardSection';
import { useCommunityData } from './useCommunityData';

/**
 * The shared side of the game: community totals, rankings and a feed of what players just did.
 * It reads nothing from the game store, so it never re-renders on a tick.
 */
export function CommunityTab() {
  const me = useCloud((cloud) => cloud.me);
  const [board, setBoard] = useState<Board>('coins');
  const data = useCommunityData(board, me !== null);

  if (data.phase === 'offline') {
    return (
      <div className="community">
        <EmptyState title="Comunidade offline" icon="clock">
          A comunidade está offline. Seu jogo continua salvo neste aparelho.
        </EmptyState>
      </div>
    );
  }

  if (data.phase === 'loading' || !data.community) {
    return (
      <div className="community" aria-busy="true" aria-label="Carregando a comunidade">
        <div className="community-skeleton community-skeleton-hero" />
        <div className="community-skeleton community-skeleton-grid" />
        <div className="community-skeleton community-skeleton-list" />
      </div>
    );
  }

  return (
    <div className="community">
      <CommunityStats data={data.community} />
      <LeaderboardSection
        board={board}
        onBoard={setBoard}
        data={data.boards[board]}
        loading={data.boardLoading}
        me={me}
        ranks={data.ranks}
      />
      <FeedSection feed={data.community.feed} now={data.fetchedAt} />
    </div>
  );
}
