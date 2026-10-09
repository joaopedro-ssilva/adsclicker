import { SAVE_VERSION } from '@/game/engine/state';
import { Icon } from '@/ui/kit';
import { Section } from '../lib/Section';
import { version } from '../../../../../package.json';

const AUTHOR_URL = 'https://github.com/joaopedro-ssilva';
const REPOSITORY_URL = 'https://github.com/joaopedro-ssilva/adsclicker';

export function About() {
  return (
    <Section title="Sobre">
      <div className="about">
        <p className="about-name display">ADSClicker</p>
        <p className="muted">
          Versão {version} · formato de save {SAVE_VERSION}
        </p>
        <p>Remaster do Edécio Clicker, 2023.</p>
        <p>
          Criado por{' '}
          <a className="about-link" href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
            João Pedro
          </a>
          .
        </p>
        <a className="about-star" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="star" size={16} />
          <span>
            <b>Gostou do jogo? Deixe uma estrela no GitHub.</b>
            <small>O código é aberto: github.com/joaopedro-ssilva/adsclicker</small>
          </span>
        </a>
      </div>
    </Section>
  );
}
