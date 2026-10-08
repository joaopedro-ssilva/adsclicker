import type { HackathonProfile } from '@/shared/hackathonApi';
import { Button } from '@/ui/kit';
import { InlineError } from '../lib/useAction';
import { AutoToggle } from './AutoToggle';
import { useStartStage } from './useStartStage';

interface StartControlsProps {
  stageId: string;
  profile: HackathonProfile;
  /** Why this stage is closed, or null. */
  lock: string | null;
  /** hk-start for the selected stage, hk-start-daily for the daily card. */
  qa: string;
  autoQa: string;
  compact?: boolean;
}

/** Auto toggle, Café cost and the start button, with the reason when it cannot start. */
export function StartControls({ stageId, profile, lock, qa, autoQa, compact = false }: StartControlsProps) {
  const { reason, disabled, start, error } = useStartStage(stageId, profile, lock);

  return (
    <div className="hk-start" data-compact={compact}>
      <AutoToggle qa={autoQa} compact={compact} />
      <div className="hk-button-note">
        <Button
          size={compact ? 'sm' : 'lg'}
          variant={disabled ? 'secondary' : 'primary'}
          aria-disabled={disabled}
          data-qa={qa}
          onClick={start}
        >
          Iniciar
          <span className="hk-price" title="Custo em Café">
            ☕ 1
          </span>
        </Button>
        {reason ? <p className="hk-reason">{reason}</p> : null}
        <InlineError message={error} />
      </div>
    </div>
  );
}
