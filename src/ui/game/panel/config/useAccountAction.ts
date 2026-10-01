import { useState } from 'react';
import type { ActionResult } from '@/game/cloud';

/** Pending flag and the server's error for one account form. */
export function useAccountAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  /** Runs the call; true when it worked. The error stays until the next run. */
  const run = async (action: () => Promise<ActionResult>): Promise<boolean> => {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) setError(result.error);
    return result.ok;
  };

  return { pending, error, run };
}
