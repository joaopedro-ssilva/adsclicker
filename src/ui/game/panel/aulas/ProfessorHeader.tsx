import { content, useGame } from '@/game/store';
import { professorViews } from '@/game/engine/views';
import type { ProfessorId } from '@/game/content/types';
import { Badge, Button, Icon } from '@/ui/kit';
import { themeVariables } from '@/ui/ThemeProvider';
import { fmt } from '../lib/numbers';

/** Who the list below belongs to: subject, production, and whether they are on stage. */
export function ProfessorHeader({ professor }: { professor: ProfessorId }) {
  const def = content.professors[professor];
  const active = useGame((store) => store.state.activeProfessor === professor);
  const production = useGame((store) => {
    const view = professorViews(store.state, content).find((entry) => entry.id === professor);
    return view ? fmt(view.production) : '0';
  });
  const setActiveProfessor = useGame((store) => store.setActiveProfessor);

  return (
    <header className="professor-header" style={themeVariables(undefined, def.color)}>
      <div className="professor-header-text">
        <h2>{def.name}</h2>
        <p>{def.subject}</p>
      </div>
      <div className="professor-header-side">
        <p className="professor-header-output">
          <Icon name="coin" size={12} />
          <strong>{production}</strong>
          <span>/s</span>
        </p>
        {active ? (
          <Badge tone="accent">Em sala · ×{content.balance.activeBonus.toString().replace('.', ',')}</Badge>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setActiveProfessor(professor)}>
            Pôr em sala
          </Button>
        )}
      </div>
    </header>
  );
}
