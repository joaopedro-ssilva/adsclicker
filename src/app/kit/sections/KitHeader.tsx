import Link from 'next/link';
import { Icon } from '@/ui/kit';

export function KitHeader() {
  return (
    <header className="kit-header">
      <div className="kit-shell kit-header-inner">
        <Link className="brand" href="/" aria-label="ADSClicker, início">
          <span className="brand-mark">
            <Icon name="click" size={24} />
          </span>
          <span>
            ADS<span className="brand-accent">Clicker</span>
          </span>
        </Link>
        <nav aria-label="Seções do laboratório" className="kit-nav">
          <a href="#componentes">Peças</a>
          <a href="#identidade">Identidade</a>
          <a href="#turma">Personagens</a>
          <a href="#cenarios">Cenários</a>
          <a href="#efeitos">Efeitos</a>
          <a href="#som">Som</a>
        </nav>
      </div>
    </header>
  );
}
