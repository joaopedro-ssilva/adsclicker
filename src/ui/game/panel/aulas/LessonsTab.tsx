import { useMemo } from 'react';
import { content, useGame, useHasFeature } from '@/game/store';
import type { ProfessorId } from '@/game/content/types';
import { useUi } from '../../shared/uiStore';
import { Section } from '../lib/Section';
import { BuyAmountSelector } from './BuyAmountSelector';
import { LevelledCard } from './LevelledCard';
import { ProfessorHeader } from './ProfessorHeader';
import { ProfessorStrip } from './ProfessorStrip';

/** The tab players live in: the disciplines and click upgrades of one professor. */
export function LessonsTab() {
  const bulkBuy = useHasFeature('bulkBuy');
  const active = useGame((store) => store.state.activeProfessor);
  const treeProfessor = useUi((ui) => ui.treeProfessor);
  const setTreeProfessor = useUi((ui) => ui.setTreeProfessor);
  const treeHired = useGame((store) => (treeProfessor ? store.state.hired[treeProfessor] : false));
  const selected: ProfessorId = treeProfessor && treeHired ? treeProfessor : active;

  const disciplines = useMemo(
    () => content.disciplines.filter((entry) => entry.professor === selected).sort((a, b) => a.tier - b.tier),
    [selected],
  );
  const clickUpgrades = useMemo(() => content.clickUpgrades.filter((entry) => entry.professor === selected), [selected]);

  return (
    <div className="lessons">
      <ProfessorStrip selected={selected} onSelect={setTreeProfessor} />
      <ProfessorHeader professor={selected} />

      <Section title="Aulas" note={bulkBuy ? <BuyAmountSelector /> : 'Edécoins por segundo'}>
        <div className="lesson-list">
          {disciplines.map((entry) => (
            <LevelledCard key={entry.id} id={entry.id} kind="discipline" />
          ))}
        </div>
      </Section>

      {clickUpgrades.length > 0 ? (
        <Section title="Cliques" note="Edécoins por clique">
          <div className="lesson-list">
            {clickUpgrades.map((entry) => (
              <LevelledCard key={entry.id} id={entry.id} kind="clickUpgrade" />
            ))}
          </div>
        </Section>
      ) : null}

      <p className="panel-hint">Cada marco de nível dobra a produção da aula. Quem está em sala rende mais.</p>
    </div>
  );
}
