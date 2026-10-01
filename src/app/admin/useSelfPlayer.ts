'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayer } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { FIRST_PAGE } from './useAdminPlayers';

/** The list has no "who am I" call, so the first pages are scanned for the row flagged `self`. */
const MAX_SCAN_PAGES = 12;

interface SelfState {
  player: AdminPlayer | null;
  done: boolean;
}

/** Finds the player of this browser. `refresh` rescans (after the cloud may have created the session). */
export function useSelfPlayer() {
  const [state, setState] = useState<SelfState>({ player: null, done: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    void (async () => {
      let found: AdminPlayer | null = null;
      for (let page = FIRST_PAGE; page < FIRST_PAGE + MAX_SCAN_PAGES && !found; page += 1) {
        const result = await api.admin.players('', page);
        if (!current) return;
        if (!result.ok) break;
        found = result.data.players.find((player) => player.self) ?? null;
        if (page * result.data.pageSize >= result.data.total) break;
      }
      if (current) setState({ player: found, done: true });
    })();
    return () => {
      current = false;
    };
  }, [version]);

  const update = useCallback((player: AdminPlayer) => setState({ player, done: true }), []);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  return { player: state.player, loading: !state.done, update, refresh };
}
