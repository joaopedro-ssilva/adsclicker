import { SAVE_VERSION } from '@/game/engine/state';
import { Section } from '../lib/Section';
import { version } from '../../../../../package.json';

export function About() {
  return (
    <Section title="Sobre">
      <div className="about">
        <p className="about-name display">ADSClicker</p>
        <p className="muted">
          Versão {version} · formato de save {SAVE_VERSION}
        </p>
        <p>Remaster do Edécio Clicker, 2023.</p>
      </div>
    </Section>
  );
}
