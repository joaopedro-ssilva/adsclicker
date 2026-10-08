import { memo, type CSSProperties } from 'react';
import type { StageDef } from '@/hackathon/content';
import { Icon } from '@/ui/kit';
import type { StageState } from './stageAccess';

interface StageNodeProps {
  stage: StageDef;
  state: StageState;
  clears: number;
  /** Short reason the stage is closed, or null. */
  lock: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** One stop of the path: number, name, and its state (victories, open, or why it is locked). */
export const StageNode = memo(function StageNode({ stage, state, clears, lock, selected, onSelect }: StageNodeProps) {
  // Serpentine over three columns: odd rows run right to left. The link points at the next stop.
  const index = stage.order - 1;
  const row = Math.floor(index / 3);
  const reversed = row % 2 === 1;
  const column = reversed ? 2 - (index % 3) : index % 3;
  const endOfRow = index % 3 === 2;
  const link = stage.boss ? 'none' : endOfRow ? 'down' : reversed ? 'left' : 'right';

  return (
    <li className="hk-stage-item" data-state={state} data-link={link} style={{ '--col': column + 1, '--row': row + 1 } as CSSProperties}>
      <button
        type="button"
        className="hk-stage"
        data-state={state}
        data-boss={stage.boss}
        aria-pressed={selected}
        data-qa={`hk-stage-${stage.id}`}
        onClick={() => onSelect(stage.id)}
      >
        <span className="hk-stage-num" aria-hidden="true">
          {stage.order}
        </span>
        <span className="hk-stage-text">
          <span className="hk-stage-name">{stage.name}</span>
          <span className="hk-stage-meta">
            {state === 'locked' ? (
              <>
                <Icon name="lock" size={12} />
                {lock}
              </>
            ) : state === 'cleared' ? (
              <>
                <Icon name="check" size={12} />
                {clears} {clears === 1 ? 'vitória' : 'vitórias'}
              </>
            ) : (
              `Nível ${stage.level}`
            )}
          </span>
          {stage.boss ? (
            <span className="hk-stage-boss">
              <Icon name="crown" size={12} />
              Chefão
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
});
