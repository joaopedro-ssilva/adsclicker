'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabBoard, LabLeaderboardResponse } from '@/shared/api';
import { LAB_BOARDS } from '@/shared/api';
import { api } from '@/shared/apiClient';

/** The server caches the lists for 10 s, so asking more often only gets the same answer. */
const REFRESH_MS = 20_000;

export type LabBoardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LabLeaderboardResponse };

type Boards = Record<LabBoard, LabBoardState>;

const LOADING: Boards = { phase: { status: 'loading' }, run: { status: 'loading' } };

/**
 * Loads both Laboratório boards when the Ranking tab opens and again every 20 s while the page is visible. A board that
 * failed keeps its last list on screen when it had one; before the first answer it says so.
 */
export function useLabBoards(): { boards: Boards; reload: () => void } {
  const [boards, setBoards] = useState<Boards>(LOADING);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return;
    for (const board of LAB_BOARDS) {
      void api.labLeaderboard(board, signal).then((result) => {
        if (signal.aborted) return;
        setBoards((previous) => {
          if (result.ok) return { ...previous, [board]: { status: 'ready', data: result.data } };
          if (previous[board].status === 'ready') return previous;
          return { ...previous, [board]: { status: 'error', message: result.error.message } };
        });
      });
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const reload = useCallback(() => {
    setBoards((previous) => ({
      phase: previous.phase.status === 'error' ? { status: 'loading' } : previous.phase,
      run: previous.run.status === 'error' ? { status: 'loading' } : previous.run,
    }));
    load();
  }, [load]);

  return { boards, reload };
}
