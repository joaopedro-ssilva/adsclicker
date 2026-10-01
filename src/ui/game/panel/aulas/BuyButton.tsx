import { useCallback } from 'react';
import { useGame } from '@/game/store';
import { Button, Icon } from '@/ui/kit';
import { useReducedMotion } from '@/ui/ThemeProvider';
import { playLimited, shake } from '../lib/feedback';
import { useHoldToBuy } from './useHoldToBuy';

interface BuyButtonProps {
  id: string;
  kind: 'discipline' | 'clickUpgrade';
  name: string;
  buyCount: number;
  cost: string;
  affordable: boolean;
}

/**
 * The buy button of a discipline or click upgrade. It stays focusable and pressable when the player cannot pay
 * (aria-disabled, not disabled), so the press can answer with a "no" sound and a wiggle.
 */
export function BuyButton({ id, kind, name, buyCount, cost, affordable }: BuyButtonProps) {
  const reduced = useReducedMotion();

  const attempt = useCallback(
    (element: HTMLElement) => {
      const store = useGame.getState();
      const bought = kind === 'discipline' ? store.buyDiscipline(id) : store.buyClickUpgrade(id);
      // The 'buy' sound comes from the game's event wiring (purchase event); only the refusal is ours.
      if (!bought) {
        playLimited('cantAfford');
        shake(element, reduced);
      }
      return bought;
    },
    [id, kind, reduced],
  );
  const hold = useHoldToBuy(attempt);

  return (
    <Button
      className="buy-button"
      variant={affordable ? 'primary' : 'secondary'}
      data-qa={`buy-${id}`}
      data-affordable={affordable}
      aria-disabled={!affordable}
      aria-label={`Comprar ${buyCount} ${buyCount === 1 ? 'nível' : 'níveis'} de ${name} por ${cost} Edécoins`}
      {...hold}
    >
      <span className="buy-button-count">
        +{buyCount} {buyCount === 1 ? 'nível' : 'níveis'}
      </span>
      <span className="buy-button-cost">
        <Icon name="coin" size={12} />
        {cost}
      </span>
    </Button>
  );
}
