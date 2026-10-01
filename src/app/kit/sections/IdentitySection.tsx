import { Icon, Panel, RarityBadge, iconNames } from '@/ui/kit';
import { iconLabels } from '../data';
import { SectionHeading } from '../parts/SectionHeading';

const TOKEN_GROUPS: { title: string; tokens: { name: string; label: string }[] }[] = [
  {
    title: 'Tema',
    tokens: [
      { name: 'bg', label: 'Fundo' },
      { name: 'surface', label: 'Superfície' },
      { name: 'surface-raised', label: 'Elevada' },
      { name: 'border', label: 'Moldura' },
      { name: 'text', label: 'Texto' },
      { name: 'text-muted', label: 'Apoio' },
    ],
  },
  {
    title: 'Destaque',
    tokens: [
      { name: 'accent', label: 'Professor' },
      { name: 'accent-soft', label: 'Suave' },
    ],
  },
  {
    title: 'Raridade',
    tokens: [
      { name: 'common', label: 'Comum' },
      { name: 'rare', label: 'Rara' },
      { name: 'epic', label: 'Épica' },
      { name: 'legendary', label: 'Lendária' },
    ],
  },
  {
    title: 'Estado',
    tokens: [
      { name: 'good', label: 'Bom' },
      { name: 'warn', label: 'Alerta' },
      { name: 'bad', label: 'Ruim' },
    ],
  },
];

export function IdentitySection() {
  return (
    <section className="kit-section" aria-labelledby="identidade">
      <SectionHeading id="identidade" number="02" title="A identidade da turma" note="Cor com propósito, pixels com espaço." />

      <Panel>
        <div className="token-groups">
          {TOKEN_GROUPS.map((group) => (
            <div key={group.title} className="token-group">
              <p className="field-label">{group.title}</p>
              <div className="token-row">
                {group.tokens.map((token) => (
                  <div key={token.name} className="token">
                    <div className="token-swatch" style={{ background: `var(--${token.name})` }} />
                    <p>{token.label}</p>
                    <code>--{token.name}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="identity-grid">
        <Panel>
          <p className="field-label">Tipografia</p>
          <p className="eyebrow">Silkscreen · títulos, números e rótulos curtos</p>
          <p className="type-display">Muito legal! 12.345</p>
          <p className="eyebrow type-gap">Nunito Sans · todo o texto corrido</p>
          <p className="type-body">A próxima conquista começa com um clique. Texto de apoio fica legível mesmo pequeno.</p>
          <p className="muted type-small">Acentos de casa: ç ã õ é ê í ó ú · 0123456789</p>
        </Panel>

        <Panel>
          <p className="field-label">Molduras</p>
          <div className="frame-samples">
            <Panel>Padrão</Panel>
            <Panel tone="raised">Elevada</Panel>
            <Panel tone="inset">Rebaixada</Panel>
          </div>
          <p className="field-label type-gap">Raridade</p>
          <div className="row">
            <RarityBadge rarity="common" />
            <RarityBadge rarity="rare" />
            <RarityBadge rarity="epic" />
            <RarityBadge rarity="legendary" />
          </div>
        </Panel>
      </div>

      <Panel>
        <p className="field-label">Ícones · grade de 12 px, sempre em escala inteira</p>
        <div className="icon-grid">
          {iconNames.map((name) => (
            <div className="icon-cell" key={name}>
              <Icon name={name} size={24} />
              <span>{iconLabels[name]}</span>
            </div>
          ))}
        </div>
        <div className="icon-scales">
          {[12, 24, 36, 48].map((size) => (
            <span key={size} className="icon-scale">
              <Icon name="coin" size={size} />
              <small>{size} px</small>
            </span>
          ))}
        </div>
      </Panel>
    </section>
  );
}
