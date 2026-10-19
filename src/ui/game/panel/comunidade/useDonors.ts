'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/apiClient';
import type { DonorsResponse } from '@/shared/api';

/** The server caches for 10 s, so asking more often only gets the same answer. */
const REFRESH_MS = 15_000;

export interface DonorsData {
  data: DonorsResponse | null;
  /** True until the first answer arrives. */
  loading: boolean;
  /** The last request failed (the previous list, if any, stays on screen). */
  failed: boolean;
  /** Asks again now (after a donation). */
  reload: () => void;
}

/** Loads the donors board while `active` and every 15 s while the page is visible; aborted when inactive or unmounted. */
export function useDonors(active: boolean): DonorsData {
  const [data, setData] = useState<DonorsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const loader = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    const load = async () => {
      const result = await api.donors(abort.signal);
      if (abort.signal.aborted) return;
      if (result.ok) {
        setData(result.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
      setLoading(false);
    };
    loader.current = load;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      loader.current = null;
    };
  }, [active]);

  const reload = useCallback(() => {
    void loader.current?.();
  }, []);

  return { data, loading, failed, reload };
}
