import { useHackathonUi } from '../../screen/uiStore';
import { HK } from '../lib/hk';
import { useBusy } from '../lib/useBusy';

interface AutoToggleProps {
  qa: string;
  /** Drops the explanation line. */
  compact?: boolean;
}

/** The automatic-mode checkbox. The preference is shared, so every start button agrees. */
export function AutoToggle({ qa, compact = false }: AutoToggleProps) {
  const auto = useHackathonUi((store) => store.auto);
  const setAuto = useHackathonUi((store) => store.setAuto);
  const { readOnly } = useBusy();
  return (
    <label className="hk-auto" title="As habilidades disparam sozinhas, com 80% do efeito">
      <input type="checkbox" checked={auto} disabled={readOnly} data-qa={qa} onChange={(event) => setAuto(event.target.checked)} />
      <span>
        <strong>Automático</strong>
        {compact ? null : <small>As habilidades disparam sozinhas com {Math.round(HK.config.autoSkillPower * 100)}% do efeito.</small>}
      </span>
    </label>
  );
}
