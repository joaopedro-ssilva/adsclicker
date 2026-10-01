import { memo } from 'react';
import { useGame } from '@/game/store';
import { Button, Icon } from '@/ui/kit';
import { useReducedMotion } from '@/ui/ThemeProvider';
import { cssVariables } from '@/ui/theme';
import { playLimited, shake } from '../lib/feedback';
import { useResearchCard } from './useResearchList';

/** One research: what it does, what it costs, and a buy button that is pressable even when unaffordable (for the "no"). */
export const ResearchCard = memo(function ResearchCard({ id }: { id: string }) {
  const data = useResearchCard(id);
  const reduced = useReducedMotion();
  if (!data) return null;

  const buy = (element: HTMLElement) => {
    const bought = useGame.getState().buyResearch(id);
    // The 'buy' sound comes from the game's event wiring (purchase event); only the refusal is ours.
    if (!bought) {
      playLimited('cantAfford');
      shake(element, reduced);
    }
  };

  return (
    <article
      className="research-card"
      data-state={data.bought ? 'done' : data.affordable ? 'ready' : 'idle'}
      style={cssVariables({ '--owner': data.color })}
    >
      <span className="research-card-icon" aria-hidden="true">
        {data.emoji}
      </span>
      <div className="research-card-body">
        <h3>{data.name}</h3>
        <p className="research-card-desc">{data.description}</p>
        <p className="research-card-owner">{data.professor}</p>
      </div>
      {data.bought ? (
        <span className="research-card-done">
          <Icon name="check" size={12} />
          Feita
        </span>
      ) : (
        <Button
          className="research-buy"
          variant={data.affordable ? 'primary' : 'secondary'}
          data-qa={`research-${id}`}
          aria-disabled={!data.affordable}
          aria-label={`Pesquisar ${data.name} por ${data.cost} ADScoins`}
          onClick={(event) => buy(event.currentTarget)}
        >
          <span className="research-buy-label">Pesquisar</span>
          <span className="research-buy-cost">
            <Icon name="coin" size={12} />
            {data.cost}
          </span>
        </Button>
      )}
    </article>
  );
});
