'use client';
import { memo, useEffect, useRef } from 'react';
import type Decimal from 'break_infinity.js';
import { useCloud } from '@/game/cloud';
import { useClickValue, useCoins, useCoinsPerSecond } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import { Icon, NumberTicker } from '@/ui/kit';
import { registerAnchor } from '../wiring/stageRefs';

/** A finite stand-in for a Decimal that grows with it: enough for the ticker to know the direction of change. */
function magnitude(value: Decimal): number {
  return value.m <= 0 ? 0 : value.e + Math.log10(value.m);
}

function Rates() {
  const perClick = useClickValue();
  const perSecond = useCoinsPerSecond();
  return (
    <p className="balance-rates">
      <span>
        <b>{formatNumber(perClick)}</b> por clique
      </span>
      <span>
        <b>{formatNumber(perSecond)}</b> por segundo
      </span>
    </p>
  );
}

/** Shown only while the server's coin multiplier is on (an event or a demo account), so a boosted game never passes for a normal one. */
function EventBadge() {
  const multiplier = useCloud((store) => store.multiplier);
  if (multiplier === 1) return null;
  return <span className="balance-dev">Evento ×{formatNumber(multiplier)}</span>;
}

/** Coin icon, the big ADScoin counter and what each click and each second are worth. Coins fly to this plate. */
export const Balance = memo(function Balance() {
  const coins = useCoins();
  const plate = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerAnchor('balance', plate.current);
    return () => registerAnchor('balance', null);
  }, []);

  return (
    <div className="balance" ref={plate} data-qa="balance">
      <EventBadge />
      <p className="balance-label">ADScoins</p>
      <div className="balance-value">
        <Icon name="coin" size={36} className="balance-coin" />
        <NumberTicker value={formatNumber(coins, { integer: true })} numericHint={magnitude(coins)} />
      </div>
      <Rates />
    </div>
  );
});
