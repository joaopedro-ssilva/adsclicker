'use client';
import { useState } from 'react';
import { cafeCost } from '@/game/engine/cafe';
import { formatNumber } from '@/game/engine/format';
import { useGameView } from '@/game/store';
import { Button, Icon } from '@/ui/kit';
import { useHackathon } from '../store';
import { clock } from '../shared/format';
import { useNow } from '../shared/useNow';

/** Stable reference for useGameView. */
const priceOf = cafeCost;

/** The Café energy: five cups, the countdown to the next one, and buying one with ADScoins. */
export function CafeCounter() {
  const cafe = useHackathon((store) => store.profile?.cafe);
  const pending = useHackathon((store) => store.pending);
  const buyCafe = useHackathon((store) => store.buyCafe);
  const price = useGameView(priceOf);
  const now = useNow(1000);
  const [message, setMessage] = useState<string | null>(null);

  if (!cafe) return null;
  const full = cafe.count >= cafe.max;

  const buy = async () => {
    setMessage(null);
    const result = await buyCafe();
    if (!result.ok) setMessage(result.message);
  };

  return (
    <section className="ar-cafe" aria-label="Café">
      <header className="ar-cafe-head">
        <h3 className="ar-cafe-title">Café</h3>
        <p className="ar-cafe-count" aria-label={`${cafe.count} de ${cafe.max} cafés`}>
          {cafe.count}/{cafe.max}
        </p>
      </header>
      <div className="ar-cups" aria-hidden="true">
        {Array.from({ length: cafe.max }, (_, index) => (
          <span key={index} className="ar-cup" data-full={index < cafe.count}>
            ☕
          </span>
        ))}
      </div>
      <p className="ar-cafe-next">
        {full || cafe.nextAt === null ? 'Cheio: toda fase gasta 1 Café' : `Próximo Café em ${clock(cafe.nextAt - now)}`}
      </p>
      <Button variant="secondary" size="sm" onClick={buy} disabled={pending || full}>
        <Icon name="coin" size={16} /> Comprar Café · {formatNumber(price, { integer: true })}
      </Button>
      {message ? (
        <p className="ar-warning" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
