import { memo } from 'react';
import type { StageDef } from '@/hackathon/content';
import { Icon } from '@/ui/kit';
import type { StageState } from './stageAccess';

interface StageNodeProps {
  stage: StageDef;
  state: StageState;
  clears: number;
  lock: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** One stop of the path: number, name, level, victories and, when closed, why. */
export const StageNode = memo(function StageNode({ stage, state, clears, lock, selected, onSelect }: StageNodeProps) {
  return (
    <li className="hk-stage-item" data-state={state} data-boss={stage.boss}>
      <button
        type="button"
        className="hk-stage"
        data-state={state}
        data-boss={stage.boss}
        aria-pressed={selected}
        data-qa={`hk-stage-${stage.id}`}
        onClick={() => onSelect(stage.id)}
      >
        <span className="hk-stage-dot" aria-hidden="true">
          {state === 'locked' ? <Icon name="lock" size={12} /> : state === 'cleared' ? <Icon name="check" size={12} /> : stage.boss ? <Icon name="crown" size={12} /> : stage.order}
        </span>
        <span className="hk-stage-text">
          <span className="hk-stage-name">{stage.name}</span>
          <span className="hk-stage-meta">
            {stage.boss ? 'Chefão · luta de promoção · ' : ''}nível {stage.level}
            {clears > 0 ? ` · ${clears} ${clears === 1 ? 'vitória' : 'vitórias'}` : ''}
          </span>
          {lock ? <span className="hk-stage-lock">{lock}</span> : null}
        </span>
      </button>
    </li>
  );
});
