import { Section } from '../lib/Section';
import { GraduationSummary } from './GraduationSummary';
import { PrestigeTree } from './PrestigeTree';
import { ResetInfo } from './ResetInfo';

/** Prestige: graduate for diplomas, spend them on the permanent tree. */
export function GraduationTab() {
  return (
    <div className="graduation-tab">
      <GraduationSummary />
      <ResetInfo />
      <Section title="Árvore de diplomas" note="Toque num nó">
        <PrestigeTree />
      </Section>
    </div>
  );
}
