'use client';
import { formatDuration } from '@/game/engine/format';
import { useJoinhaView } from '@/game/store';
import { LayerReveal } from '../LayerReveal';

const times = (value: number) => `×${value.toFixed(2).replace('.', ',').replace(/,?0+$/, '')}`;

/**
 * Joinha de Ouro, beside the professor: the state of the golden mode. Active (gold card, the multiplier and the time
 * left, the bar drains), recharging (the time left, the bar fills) or ready (a full combo starts it). The professor
 * glows for the whole mode too (see ClickerButton).
 */
export function GoldenState() {
  const view = useJoinhaView();
  if (!view) return null;

  const state = view.active ? 'active' : view.recharge ? 'recharge' : 'ready';
  const left = view.active?.leftMs ?? view.recharge?.leftMs ?? 0;
  const total = view.active?.totalMs ?? view.recharge?.totalMs ?? 1;
  const fraction = state === 'active' ? left / total : state === 'recharge' ? 1 - left / total : 1;
  const time = formatDuration(Math.ceil(left / 1000) * 1000);

  const label =
    state === 'active'
      ? `Modo ouro ${times(view.multiplier)}: ${time} restantes`
      : state === 'recharge'
        ? `Joinha de Ouro em recarga: ${time} restantes`
        : 'Joinha de Ouro pronto: encha o combo';

  return (
    <LayerReveal layer="joinha" className="golden-slot">
      <div
        className="golden"
        data-state={state}
        data-qa="golden-state"
        role="img"
        aria-label={label}
      >
        <p className="golden-title">
          <span aria-hidden="true">👍</span> {state === 'active' ? 'Ouro!' : 'Joinha'}
        </p>
        <div className="golden-bar" aria-hidden="true">
          <b style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
        </div>
        <p className="golden-label" aria-hidden="true">
          {state === 'active' ? (
            <>
              {times(view.multiplier)} · <b>{time}</b>
            </>
          ) : state === 'recharge' ? (
            <>
              Recarga <b>{time}</b>
            </>
          ) : (
            'Pronto: combo cheio'
          )}
        </p>
      </div>
    </LayerReveal>
  );
}
