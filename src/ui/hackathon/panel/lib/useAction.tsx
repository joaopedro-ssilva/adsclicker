import { useCallback, useState } from 'react';
import { audio } from '@/ui/audio';
import { toast, type ToastOptions } from '@/ui/kit';
import type { ActionResult } from '@/ui/hackathon/store';

type Run = (action: Promise<ActionResult>, success?: ToastOptions | string) => Promise<boolean>;

/**
 * Runs a store action and keeps the server's refusal (pt-BR) in `error`, to render next to the button.
 * A new attempt clears it. Successes play the buy sound and may toast.
 */
export function useAction(): { run: Run; error: string | null; clear: () => void } {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback<Run>(async (action, success) => {
    const result = await action;
    if (result.ok) {
      setError(null);
      audio.play('buy');
      if (success) toast(typeof success === 'string' ? { title: success, tone: 'good' } : success);
      return true;
    }
    audio.play('cantAfford');
    setError(result.message);
    return false;
  }, []);
  const clear = useCallback(() => setError(null), []);
  return { run, error, clear };
}

/** The refusal under an action, announced to screen readers. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="hk-error" role="alert" data-qa="hk-error">
      {message}
    </p>
  );
}
