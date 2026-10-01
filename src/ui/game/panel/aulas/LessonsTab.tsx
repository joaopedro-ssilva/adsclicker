import { useMemo } from 'react';
import { content, useGame, useHasFeature } from '@/game/store';
import { Section } from '../lib/Section';
import { BuyAmountSelector } from './BuyAmountSelector';
import { LevelledCard } from './LevelledCard';
import { ProfessorHeader } from './ProfessorHeader';
import { ProfessorStrip } from './ProfessorStrip';

/** The tab players live in: the disciplines and click upgrades of one professor. */
export function LessonsTab() {
  const bulkBuy = useHasFeature('bulkBuy');
  // One selection for the whole screen: the professor picked here is the one shown on the stage.
  const selected = useGame((store) => store.state.activeProfessor);
  const selectProfessor = useGame((store) => store.setActiveProfessor);

  const disciplines = useMemo(
    () => content.disciplines.filter((entry) => entry.professor === selected).sort((a, b) => a.tier - b.tier),
    [selected],
  );
  const clickUpgrades = useMemo(() => content.clickUpgrades.filter((entry) => entry.professor === selected), [selected]);

  return (
    <div className="lessons">
      <ProfessorStrip selected={selected} onSelect={selectProfessor} />
      <ProfessorHeader professor={selected} />

      <Section title="Aulas" note={bulkBuy ? <BuyAmountSelector /> : 'ADScoins por segundo'}>
        <div className="lesson-list">
          {disciplines.map((entry) => (
            <LevelledCard key={entry.id} id={entry.id} kind="discipline" />
          ))}
        </div>
      </Section>

      {clickUpgrades.length > 0 ? (
        <Section title="Cliques" note="ADScoins por clique">
          <div className="lesson-list">
            {clickUpgrades.map((entry) => (
              <LevelledCard key={entry.id} id={entry.id} kind="clickUpgrade" />
            ))}
          </div>
        </Section>
      ) : null}

      <p className="panel-hint">Cada marco de nível dobra a produção da aula.</p>
    </div>
  );
}
