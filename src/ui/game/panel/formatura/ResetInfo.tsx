import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { Icon } from '@/ui/kit';

const RESETS = [
  'Edécoins da turma',
  'Níveis das aulas e dos upgrades de clique',
  'Pesquisas',
  'Professores contratados',
  'Buffs, invasões, sprints e recargas',
];

const STAYS = ['Diplomas e a árvore', 'Conquistas', 'Skins, cenários e temas', 'Estatísticas e configurações'];

/** What a graduation wipes and what it keeps (professors kept by the tree are listed by name). */
export function ResetInfo() {
  const kept = useGame(
    useShallow((store) =>
      content.prestigeNodes
        .filter((node) => (store.state.prestige[node.id] ?? 0) > 0)
        .flatMap((node) => node.keepsProfessors ?? [])
        .map((id) => content.professors[id].name),
    ),
  );

  return (
    <div className="reset-info">
      <section data-kind="resets">
        <h3>
          <Icon name="x" size={12} /> Volta ao começo
        </h3>
        <ul>
          {RESETS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="muted">Edécio sempre fica{kept.length > 0 ? `, e também ${kept.join(', ')}` : ''}.</p>
      </section>
      <section data-kind="stays">
        <h3>
          <Icon name="check" size={12} /> Fica com você
        </h3>
        <ul>
          {STAYS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
