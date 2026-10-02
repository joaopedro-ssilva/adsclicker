'use client';
import { useCoins } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import { Icon } from '@/ui/kit';

/** The ADScoins in a small pill, for the Hackathon header (the classroom keeps running underneath). */
export function CompactBalance() {
  const coins = useCoins();
  return (
    <p className="ar-balance" aria-label="ADScoins">
      <Icon name="coin" size={20} />
      <b>{formatNumber(coins, { integer: true })}</b>
      <span>ADScoins</span>
    </p>
  );
}
