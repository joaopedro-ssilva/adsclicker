'use client';
import { useEffect, useState } from 'react';
import { Keycap } from '@/ui/kit';
import { AUTO_CHOICE_MS } from '../store/createHackathon';
import { useHackathon } from '../store';
import { waveBuffById } from '../shared/lookup';

interface ChoiceCardsProps {
  offer: [string, string, string];
  auto: boolean;
}

/** Between waves: three upgrades, pick one (keys 1, 2, 3). In auto mode the first is taken after a short pause. */
export function ChoiceCards({ offer, auto }: ChoiceCardsProps) {
  const choose = useHackathon((store) => store.choose);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(Math.ceil(AUTO_CHOICE_MS / 1000));

  useEffect(() => {
    if (!auto) return;
    const started = performance.now();
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((AUTO_CHOICE_MS - (performance.now() - started)) / 1000))), 250);
    return () => clearInterval(timer);
  }, [auto]);

  const pick = (option: 0 | 1 | 2) => {
    if (picked !== null) return;
    setPicked(option);
    choose(option);
  };

  return (
    <div className="ar-choice" role="group" aria-label="Escolha uma melhoria" data-no-flow>
      <p className="ar-choice-title">Escolha uma melhoria</p>
      <div className="ar-choice-cards">
        {offer.map((id, index) => {
          const buff = waveBuffById.get(id);
          const option = index as 0 | 1 | 2;
          return (
            <button
              key={id}
              type="button"
              className="ar-card"
              data-picked={picked === index}
              disabled={picked !== null}
              onClick={() => pick(option)}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className="ar-card-key" aria-hidden="true">
                <Keycap>{index + 1}</Keycap>
              </span>
              <span className="ar-card-emoji" aria-hidden="true">
                {buff?.emoji ?? '✨'}
              </span>
              <span className="ar-card-name">{buff?.name ?? id}</span>
              <span className="ar-card-text">{buff?.description ?? ''}</span>
            </button>
          );
        })}
      </div>
      {auto && picked === null ? <p className="ar-choice-auto">Escolhendo sozinho em {left}s</p> : null}
    </div>
  );
}
