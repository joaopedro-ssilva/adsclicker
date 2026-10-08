import { useCallback, useEffect, useRef } from 'react';
import { cafeCost } from '@/game/engine/cafe';
import type { GameContent } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';
import { fmt } from '@/ui/game/panel/lib/numbers';
import { useSlowView } from '@/ui/game/panel/lib/useSlowView';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button, Icon } from '@/ui/kit';
import { Card } from '../../screen/Card';
import { countdown } from '../lib/dateKey';
import { HK } from '../lib/hk';
import { useBusy } from '../lib/useBusy';
import { useNow } from '../lib/useNow';
import { InlineError, useAction } from '../lib/useAction';

/** Price and balance of the next Café, read once a second instead of at every classroom tick. */
function cafeQuote(state: GameState, game: GameContent): { price: string; affordable: boolean } {
  const cost = cafeCost(state, game);
  return { price: fmt(cost), affordable: state.coins.gte(cost) };
}

/** Café: how many cups, when the next one arrives and the classroom purchase. */
export function CafeCard({ profile }: { profile: HackathonProfile }) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const now = useNow(1000);
  const quote = useSlowView(cafeQuote);
  const { count, max, nextAt } = profile.cafe;
  const full = count >= max;

  // The profile only knows the Café as of the last answer: ask again once the countdown ends.
  const asked = useRef<number | null>(null);
  useEffect(() => {
    if (nextAt === null || now < nextAt || asked.current === nextAt) return;
    asked.current = nextAt;
    void useHackathon.getState().load();
  }, [now, nextAt]);

  const buy = useCallback(() => {
    void report(useHackathon.getState().buyCafe());
  }, [report]);

  const reason = full ? 'Café cheio' : !quote.affordable ? 'ADScoins insuficientes' : null;

  return (
    <Card
      title="Café"
      icon="clock"
      qa="hk-cafe"
      className="hk-cafe"
      aside={
        <b className="hk-cafe-count">
          {count}/{max}
        </b>
      }
    >
      <div className="hk-cups" role="img" aria-label={`${count} de ${max} cafés`}>
        {Array.from({ length: max }, (_, index) => (
          <span key={index} data-on={index < count}>
            ☕
          </span>
        ))}
      </div>
      <p className="hk-cafe-timer">
        {full || nextAt === null ? (
          'Café cheio'
        ) : (
          <>
            Recarga em <strong>{countdown(nextAt - now)}</strong>
          </>
        )}
      </p>
      <p className="hk-note">Cada fase gasta 1 · volta 1 a cada {HK.config.cafe.regenMinutes} min</p>
      <div className="hk-button-note">
        <Button
          variant={reason ? 'secondary' : 'primary'}
          size="sm"
          disabled={locked}
          aria-disabled={reason !== null}
          data-qa="hk-buy-cafe"
          onClick={() => {
            if (reason) return;
            buy();
          }}
        >
          Comprar
          <span className="hk-price">
            <Icon name="coin" size={12} />
            {quote.price}
          </span>
        </Button>
        {reason ? <p className="hk-reason">{reason}</p> : null}
        <InlineError message={error} />
      </div>
    </Card>
  );
}
