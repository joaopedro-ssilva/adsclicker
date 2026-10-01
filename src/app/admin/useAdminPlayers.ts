'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayer, AdminPlayersResponse, ApiErrorCode } from '@/shared/api';
import { api } from '@/shared/apiClient';

/** The API numbers pages from 1. */
export const FIRST_PAGE = 1;

interface Answer {
  /** The query this answer belongs to, so a slower old answer never replaces a newer one. */
  key: string;
  data: AdminPlayersResponse | null;
  error: { code: ApiErrorCode; message: string } | null;
  fetchedAt: number;
}

export interface AdminPlayersState {
  search: string;
  page: number;
  data: AdminPlayersResponse | null;
  error: Answer['error'];
  /** Epoch ms of the last answer, the shared "now" of the rows. */
  fetchedAt: number;
  /** True while the answer for the current search and page has not arrived. The previous list stays visible. */
  loading: boolean;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  reload: () => void;
  /** Swaps one row for the server's fresh copy after an action. */
  replacePlayer: (player: AdminPlayer) => void;
}

export function useAdminPlayers(): AdminPlayersState {
  const [search, setSearchState] = useState('');
  const [page, setPage] = useState(FIRST_PAGE);
  const [version, setVersion] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const key = `${search}|${page}|${version}`;

  useEffect(() => {
    let current = true;
    void api.admin.players(search, page).then((result) => {
      if (!current) return;
      setAnswer((previous) => ({
        key,
        // Keep the last list on screen when a refresh fails.
        data: result.ok ? result.data : (previous?.data ?? null),
        error: result.ok ? null : result.error,
        fetchedAt: Date.now(),
      }));
    });
    return () => {
      current = false;
    };
  }, [key, search, page]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(FIRST_PAGE);
  }, []);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const replacePlayer = useCallback((player: AdminPlayer) => {
    setAnswer((previous) =>
      previous?.data
        ? {
            ...previous,
            data: { ...previous.data, players: previous.data.players.map((row) => (row.id === player.id ? player : row)) },
          }
        : previous,
    );
  }, []);

  return {
    search,
    page,
    data: answer?.data ?? null,
    error: answer?.error ?? null,
    fetchedAt: answer?.fetchedAt ?? 0,
    loading: answer?.key !== key,
    setSearch,
    setPage,
    reload,
    replacePlayer,
  };
}
