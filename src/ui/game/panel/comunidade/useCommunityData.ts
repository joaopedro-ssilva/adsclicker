'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/apiClient';
import type { Board, CommunityResponse, LeaderboardResponse, RanksResponse } from '@/shared/api';

/** The server caches for 10 s, so asking more often only gets the same answer. */
const REFRESH_MS = 15_000;

export type CommunityPhase = 'loading' | 'ready' | 'offline';

export interface CommunityData {
  phase: CommunityPhase;
  community: CommunityResponse | null;
  /** Last list received for each board; kept while a newer one loads. */
  boards: Partial<Record<Board, LeaderboardResponse>>;
  /** True until the first answer for the selected board arrives. */
  boardLoading: boolean;
  ranks: RanksResponse['ranks'] | null;
  /** Epoch ms of the last community answer, for "now" in relative times. */
  fetchedAt: number;
}

/**
 * Loads the community numbers, the selected board and the player's own ranks when the tab opens and
 * every 15 s while the page is visible. Everything is aborted on unmount; the last data stays on screen
 * while a refresh runs or fails.
 */
export function useCommunityData(board: Board, signedIn: boolean): CommunityData {
  const [phase, setPhase] = useState<CommunityPhase>('loading');
  const [community, setCommunity] = useState<CommunityResponse | null>(null);
  const [boards, setBoards] = useState<Partial<Record<Board, LeaderboardResponse>>>({});
  const [boardFailed, setBoardFailed] = useState(false);
  const [ranks, setRanks] = useState<RanksResponse['ranks'] | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);

  const controller = useRef<AbortController | null>(null);
  const boardRef = useRef(board);
  const signedInRef = useRef(signedIn);
  useEffect(() => {
    boardRef.current = board;
    signedInRef.current = signedIn;
  });

  const loadBoard = useCallback(async (which: Board, signal: AbortSignal) => {
    const result = await api.leaderboard(which, signal);
    if (signal.aborted) return;
    if (result.ok) {
      setBoards((previous) => ({ ...previous, [which]: result.data }));
      setBoardFailed(false);
    } else {
      setBoardFailed(true);
    }
  }, []);

  const loadShared = useCallback(async (signal: AbortSignal) => {
    const [communityResult, ranksResult] = await Promise.all([
      api.community(signal),
      signedInRef.current ? api.ranks() : Promise.resolve(null),
    ]);
    if (signal.aborted) return;
    if (communityResult.ok) {
      setCommunity(communityResult.data);
      setFetchedAt(Date.now());
      setPhase('ready');
    } else {
      setPhase((previous) => (previous === 'ready' ? previous : 'offline'));
    }
    if (ranksResult?.ok) setRanks(ranksResult.data.ranks);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    const refresh = () => {
      void loadShared(abort.signal);
      void loadBoard(boardRef.current, abort.signal);
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadShared, loadBoard]);

  // Switching boards loads that board right away (the first run above already covers the initial one).
  const firstBoard = useRef(board);
  useEffect(() => {
    if (firstBoard.current === board) return;
    firstBoard.current = board;
    const signal = controller.current?.signal;
    if (signal && !signal.aborted) void loadBoard(board, signal);
  }, [board, loadBoard]);

  // A player who just got a nickname or session shows up in ranks without waiting for the next cycle.
  useEffect(() => {
    const signal = controller.current?.signal;
    if (signedIn && signal && !signal.aborted) void loadShared(signal);
  }, [signedIn, loadShared]);

  const current = boards[board];
  return {
    phase,
    community,
    boards,
    boardLoading: current === undefined && !boardFailed,
    ranks,
    fetchedAt,
  };
}
