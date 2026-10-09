import { Section } from '../lib/Section';
import { GraduationSummary } from './GraduationSummary';
import { HonourPicker } from './HonourPicker';
import { MaestriasSection } from './maestrias/MaestriasSection';
import { MonitorsSection } from './monitors/MonitorsSection';
import { PrestigeTree } from './PrestigeTree';
import { ResetInfo } from './ResetInfo';

/** Prestige: graduate for diplomas, spend them on the permanent tree. */
export function GraduationTab() {
  return (
    <div className="graduation-tab">
      <GraduationSummary />
      <MaestriasSection />
      <HonourPicker />
      <ResetInfo />
      <MonitorsSection />
      <Section title="Árvore de diplomas" note="Toque num nó">
        <PrestigeTree />
      </Section>
    </div>
  );
}
