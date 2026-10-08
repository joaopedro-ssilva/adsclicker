import { ProgressBar } from '@/ui/kit';
import { MILESTONE_SEGMENTS } from './useLevelledCard';

interface MilestoneBarProps {
  filledSegments: number;
  nextMilestone: number | null;
  /** What the milestone multiplies the output by. */
  nextMult: number;
}

/** Progress to the next level that doubles the output. */
export function MilestoneBar({ filledSegments, nextMilestone, nextMult }: MilestoneBarProps) {
  return (
    <div className="milestone">
      <ProgressBar
        value={filledSegments}
        max={MILESTONE_SEGMENTS}
        ariaLabel={nextMilestone === null ? 'Todos os marcos alcançados' : `Rumo ao marco do nível ${nextMilestone}`}
        size="sm"
        segmented
        segments={MILESTONE_SEGMENTS}
        tone="good"
      />
      <span className="milestone-text">{nextMilestone === null ? 'Marcos completos' : `×${nextMult} no nível ${nextMilestone}`}</span>
    </div>
  );
}
