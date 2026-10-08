import { useCallback } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { useHackathonUi } from '../../screen/uiStore';
import { useAction } from '../lib/useAction';
import { useBusy } from '../lib/useBusy';

/**
 * Everything a start button needs: why it cannot start (or null), the start itself with the shared
 * automatic preference, and the server's refusal. `lock` is the stage's own lock, from stageAccess.
 */
export function useStartStage(stageId: string, profile: HackathonProfile, lock: string | null) {
  const { readOnly, locked } = useBusy();
  const { run, error, clear } = useAction();
  const auto = useHackathonUi((store) => store.auto);
  const noCafe = profile.cafe.count < 1;
  const reason = readOnly ? 'Há uma luta em andamento' : (lock ?? (noCafe ? 'Sem Café: espere o próximo ou compre um' : null));
  const disabled = reason !== null || locked;

  const start = useCallback(() => {
    if (disabled) return;
    clear();
    void run(useHackathon.getState().startRun(stageId, auto));
  }, [disabled, clear, run, stageId, auto]);

  return { reason, disabled, start, error };
}
