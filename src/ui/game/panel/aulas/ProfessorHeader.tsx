import { content, useGame } from '@/game/store';
import { professorViews } from '@/game/engine/views';
import type { ProfessorId } from '@/game/content/types';
import { Icon } from '@/ui/kit';
import { themeVariables } from '@/ui/ThemeProvider';
import { fmt } from '../lib/numbers';

/** Who the list below belongs to: name, subject and what their lessons produce. */
export function ProfessorHeader({ professor }: { professor: ProfessorId }) {
  const def = content.professors[professor];
  const production = useGame((store) => {
    const view = professorViews(store.state, content).find((entry) => entry.id === professor);
    return view ? fmt(view.production) : '0';
  });

  return (
    <header className="professor-header" style={themeVariables(undefined, def.color)}>
      <div className="professor-header-text">
        <h2>{def.name}</h2>
        <p>{def.subject}</p>
      </div>
      <p className="professor-header-output">
        <Icon name="coin" size={12} />
        <strong>{production}</strong>
        <span>/s</span>
      </p>
    </header>
  );
}
