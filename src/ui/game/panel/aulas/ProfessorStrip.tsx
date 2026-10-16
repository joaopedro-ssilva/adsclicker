import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId } from '@/game/content/types';
import { themeVariables } from '@/ui/ThemeProvider';
import { LabStripChip } from '../../lab/LabEntry';
import { PostdocBadge } from '../../shared/PostdocBadge';
import { Portrait } from '../lib/Portrait';

interface ProfessorStripProps {
  selected: ProfessorId;
  onSelect: (id: ProfessorId) => void;
}

/** One portrait per hired professor, all eight visible at once: picks who is on screen and whose lessons are listed. */
export function ProfessorStrip({ selected, onSelect }: ProfessorStripProps) {
  const hired = useGame(useShallow((store) => PROFESSOR_IDS.filter((id) => store.state.hired[id])));
  const stars = useGame((store) => store.state.postdoc.stars);

  return (
    <div className="professor-strip" role="group" aria-label="Professor">
      {hired.map((id) => {
        const professor = content.professors[id];
        return (
          <button
            key={id}
            type="button"
            className="professor-chip"
            style={themeVariables(undefined, professor.color)}
            aria-pressed={id === selected}
            data-starred={(stars[id] ?? 0) > 0 || undefined}
            aria-label={professor.name}
            title={professor.name}
            data-qa={`tree-${id}`}
            onClick={() => onSelect(id)}
          >
            <Portrait professor={id} />
            <PostdocBadge stars={stars[id] ?? 0} />
          </button>
        );
      })}
      <LabStripChip />
    </div>
  );
}
