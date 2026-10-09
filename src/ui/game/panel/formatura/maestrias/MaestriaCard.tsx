import { content, useGame } from '@/game/store';
import type { MaestriaCardView } from '@/game/engine/views';
import type { ProfessorId } from '@/game/content/types';
import { themeVariables, useReducedMotion } from '@/ui/ThemeProvider';
import { Badge, Button, Icon } from '@/ui/kit';
import { playLimited, shake } from '../../lib/feedback';
import { Portrait } from '../../lib/Portrait';
import { MaestriaLive } from './MaestriaLive';

interface MaestriaCardProps {
  card: MaestriaCardView;
  /** The player has a slot to spend. */
  slotFree: boolean;
  onPickSlot: (professor: ProfessorId) => void;
}

/** One professor's Maestria: what it is, its level, and the one action that fits (use the slot, buy the next level). */
export function MaestriaCard({ card, slotFree, onPickSlot }: MaestriaCardProps) {
  const professor = content.professors[card.professor];
  const reduced = useReducedMotion();
  const buy = useGame((store) => store.buyMaestriaLevel);
  const state = !card.built ? 'soon' : card.unlocked ? 'on' : 'off';

  const upgrade = (element: HTMLElement) => {
    if (buy(card.professor)) return;
    playLimited('cantAfford', 120);
    shake(element, reduced);
  };

  return (
    <article
      className="maestria"
      data-state={state}
      data-qa={`maestria-${card.professor}`}
      style={themeVariables(undefined, professor.color)}
    >
      <Portrait professor={card.professor} />
      <div className="maestria-body">
        <header className="maestria-head">
          <h3>{card.name}</h3>
          <span className="maestria-prof">{professor.name}</span>
        </header>
        <p className="maestria-summary">{card.summary}</p>

        {card.built && card.unlocked ? (
          <>
            <div className="maestria-level" role="img" aria-label={`Nível ${card.level} de ${card.maxLevel}`}>
              {Array.from({ length: card.maxLevel }, (_, index) => (
                <i key={index} data-on={index < card.level} />
              ))}
              <span>
                Nível {card.level}/{card.maxLevel}
              </span>
            </div>
            <ul className="maestria-lines">
              {card.levels.map((line, index) => (
                <li key={index} data-reached={index < card.level} data-current={index === card.level - 1}>
                  <b>{index + 1}</b> {line}
                </li>
              ))}
            </ul>
            <MaestriaLive professor={card.professor} />
          </>
        ) : null}
        {card.built && !card.unlocked ? (
          <ul className="maestria-lines maestria-lines-preview">
            {card.levels.slice(0, 1).map((line, index) => (
              <li key={index}>
                <b>1</b> {line}
              </li>
            ))}
            <li className="maestria-more">Mais 4 níveis, comprados com diplomas.</li>
          </ul>
        ) : null}
      </div>

      <div className="maestria-action">
        {!card.built ? (
          <Badge tone="neutral">Em breve</Badge>
        ) : !card.unlocked ? (
          <Button
            size="sm"
            disabled={!slotFree}
            data-qa={`maestria-use-${card.professor}`}
            onClick={() => onPickSlot(card.professor)}
          >
            {slotFree ? 'Usar a vaga' : 'Sem vaga'}
          </Button>
        ) : card.nextCost === null ? (
          <Badge tone="good">
            <Icon name="check" size={12} /> Máximo
          </Badge>
        ) : (
          <Button
            size="sm"
            variant={card.affordable ? 'primary' : 'secondary'}
            aria-disabled={!card.affordable}
            data-qa={`maestria-buy-${card.professor}`}
            onClick={(event) => upgrade(event.currentTarget)}
          >
            Nível {card.level + 1}
            <span className="maestria-cost">
              <Icon name="diploma" size={12} />
              {card.nextCost}
            </span>
          </Button>
        )}
      </div>
    </article>
  );
}
