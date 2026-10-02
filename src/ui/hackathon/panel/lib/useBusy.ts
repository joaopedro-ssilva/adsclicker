import { useHackathon } from '@/ui/hackathon/store';

/** Whether the panel's actions must be off: a fight is running (read-only) or a request is in flight. */
export function useBusy(): { readOnly: boolean; pending: boolean; locked: boolean } {
  const readOnly = useHackathon((store) => store.run !== null);
  const pending = useHackathon((store) => store.pending);
  return { readOnly, pending, locked: readOnly || pending };
}
