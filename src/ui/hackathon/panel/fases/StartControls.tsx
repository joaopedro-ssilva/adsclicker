import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button } from '@/ui/kit';
import { HK } from '../lib/hk';
import { InlineError, useAction } from '../lib/useAction';
import { useBusy } from '../lib/useBusy';

interface StartControlsProps {
  stageId: string;
  profile: HackathonProfile;
  auto: boolean;
  onAuto: (value: boolean) => void;
  /** Why this stage is closed, or null. */
  lock: string | null;
  /** hk-start for the selected stage, hk-start-daily for the daily card. */
  qa: string;
  autoQa: string;
  compact?: boolean;
}

/** Auto toggle, Café cost and the start button, with the reason when it cannot start. */
export function StartControls({ stageId, profile, auto, onAuto, lock, qa, autoQa, compact = false }: StartControlsProps) {
  const { readOnly, locked } = useBusy();
  const { run, error, clear } = useAction();
  const noCafe = profile.cafe.count < 1;
  const reason = readOnly ? 'Há uma luta em andamento' : (lock ?? (noCafe ? 'Sem Café: espere o próximo ou compre na aba Aluno' : null));

  return (
    <div className="hk-start" data-compact={compact}>
      <label className="hk-auto" title="As habilidades disparam sozinhas, com 80% do efeito">
        <input type="checkbox" checked={auto} disabled={readOnly} data-qa={autoQa} onChange={(event) => onAuto(event.target.checked)} />
        <span>
          <strong>Automático</strong>
          {compact ? null : <small>As habilidades disparam sozinhas com {Math.round(HK.config.autoSkillPower * 100)}% do efeito.</small>}
        </span>
      </label>
      <div className="hk-button-note">
        <Button
          size={compact ? 'sm' : 'lg'}
          variant={reason || locked ? 'secondary' : 'primary'}
          aria-disabled={reason !== null || locked}
          data-qa={qa}
          onClick={() => {
            if (reason || locked) return;
            clear();
            void run(useHackathon.getState().startRun(stageId, auto));
          }}
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
