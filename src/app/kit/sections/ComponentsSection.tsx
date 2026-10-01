import type { ProfessorId } from '@/game/content/types';
import { SectionHeading } from '../parts/SectionHeading';
import { ButtonsSpecimen } from '../specimens/ButtonsSpecimen';
import { OverlaysSpecimen } from '../specimens/OverlaysSpecimen';
import { ProgressSpecimen } from '../specimens/ProgressSpecimen';
import { TabsSpecimen } from '../specimens/TabsSpecimen';
import { TickerSpecimen } from '../specimens/TickerSpecimen';

export function ComponentsSection({ professorId }: { professorId: ProfessorId }) {
  return (
    <section className="kit-section" aria-labelledby="componentes">
      <SectionHeading id="componentes" number="01" title="Feito para clicar" note="Controles, estados e pequenos retornos." />
      <div className="component-grid">
        <ButtonsSpecimen />
        <ProgressSpecimen />
        <TickerSpecimen />
        <TabsSpecimen professorId={professorId} />
        <OverlaysSpecimen />
      </div>
    </section>
  );
}
