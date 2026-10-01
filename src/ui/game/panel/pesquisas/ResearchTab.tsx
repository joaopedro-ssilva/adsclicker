import { Badge, EmptyState, Icon } from '@/ui/kit';
import { Section } from '../lib/Section';
import { ResearchCard } from './ResearchCard';
import { useResearchLists } from './useResearchList';

/** Visible research, cheapest first; bought ones fold into "Concluídas". */
export function ResearchTab() {
  const { open, bought, hidden } = useResearchLists();

  return (
    <div className="research">
      <Section title="Pesquisas" note={open.length > 0 ? `${open.length} disponíveis` : undefined}>
        {open.length > 0 ? (
          <div className="research-list">
            {open.map((id) => (
              <ResearchCard key={id} id={id} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nada para pesquisar agora" icon="flask">
            {bought.length > 0 ? 'Você concluiu tudo o que está aberto. Evolua as aulas para novas pesquisas aparecerem.' : 'Suba o nível das aulas: as pesquisas aparecem conforme você avança.'}
          </EmptyState>
        )}
      </Section>

      {hidden > 0 ? (
        <p className="panel-hint">
          <Icon name="lock" size={12} /> Mais {hidden} {hidden === 1 ? 'pesquisa aparece' : 'pesquisas aparecem'} quando você avançar.
        </p>
      ) : null}

      {bought.length > 0 ? (
        <details className="research-done">
          <summary>
            <span>Concluídas</span>
            <Badge tone="good">{bought.length}</Badge>
          </summary>
          <div className="research-list">
            {bought.map((id) => (
              <ResearchCard key={id} id={id} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
