'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult } from '@/shared/apiClient';

export interface ActionMessage {
  tone: 'ok' | 'bad';
  text: string;
}

/**
 * Runs one admin call at a time and keeps its outcome as an inline message.
 * The message clears itself after a while so a stale "Feito" does not linger.
 */
export function useApiAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async function run<T>(call: () => Promise<ApiResult<T>>, okText: string): Promise<T | null> {
    setBusy(true);
    setMessage(null);
    window.clearTimeout(timer.current);
    const result = await call();
    if (!mounted.current) return result.ok ? result.data : null;
    setBusy(false);
    setMessage(result.ok ? { tone: 'ok', text: okText } : { tone: 'bad', text: result.error.message });
    timer.current = window.setTimeout(() => setMessage(null), result.ok ? 4000 : 9000);
    return result.ok ? result.data : null;
  }, []);

  return { busy, message, run };
}
