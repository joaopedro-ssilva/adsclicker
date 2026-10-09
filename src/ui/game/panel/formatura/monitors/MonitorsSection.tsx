import { useMonitorsView } from '@/game/store';
import { Section } from '../../lib/Section';
import { MonitorCard } from './MonitorCard';

/** Monitores: students hired with diplomas who take over a chore. Open after the first Formatura. */
export function MonitorsSection() {
  const view = useMonitorsView();
  const hired = view.monitors.filter((monitor) => monitor.level > 0).length;

  return (
    <Section title="Monitores" note={view.unlocked ? `${hired}/${view.monitors.length} contratados` : 'Depois da 1ª Formatura'}>
      <div className="monitors" data-qa="monitors">
        <p className="monitors-intro">
          Alunos que assumem uma tarefa chata, contratados com diplomas. Ficam com você entre uma Formatura e outra, e o
          que eles fazem não conta para as conquistas de jogar na mão.
        </p>
        {view.unlocked ? (
          <div className="monitors-list">
            {view.monitors.map((monitor) => (
              <MonitorCard key={monitor.id} view={monitor} settings={view.settings} />
            ))}
          </div>
        ) : (
          <p className="monitors-locked">Forme a primeira turma e eles se candidatam.</p>
        )}
      </div>
    </Section>
  );
}
