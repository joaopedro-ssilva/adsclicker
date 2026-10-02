'use client';
import { useEffect, useState } from 'react';
import { TICK_MS } from '@/hackathon/engine';
import type { ActiveRun } from '../store';
import { useHackathon } from '../store';
import { clock } from '../shared/format';

interface ArenaHudProps {
  run: ActiveRun;
}

/** Top of the arena: the stage, the wave counter, the wave timer when there is one, and the way out. */
export function ArenaHud({ run }: ArenaHudProps) {
  const abandonRun = useHackathon((store) => store.abandonRun);
  const [confirming, setConfirming] = useState(false);
  const { state, stage } = run;
  const over = state.phase === 'won' || state.phase === 'lost';
  const timeLeftMs = state.waveTicksLeft === null ? null : state.waveTicksLeft * TICK_MS;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <div className="ar-hud">
      <div className="ar-hud-left">
        <p className="ar-hud-stage">{stage.name}</p>
        {run.auto ? <span className="ar-badge">Automático</span> : null}
      </div>
      <div className="ar-hud-wave" aria-label={`Onda ${Math.min(state.wave + 1, state.waveCount)} de ${state.waveCount}`}>
        <span className="ar-hud-wave-text">
          Onda {Math.min(state.wave + 1, state.waveCount)}/{state.waveCount}
        </span>
        <span className="ar-pips" aria-hidden="true">
          {Array.from({ length: state.waveCount }, (_, index) => (
            <i key={index} data-state={index < state.wave ? 'done' : index === state.wave ? 'now' : 'next'} />
          ))}
        </span>
      </div>
      <div className="ar-hud-right">
        {timeLeftMs !== null && !over ? (
          <p className="ar-wave-timer" data-urgent={timeLeftMs <= 5000} aria-label="Tempo da onda">
            ⏱ {clock(timeLeftMs)}
          </p>
        ) : null}
        {!over ? (
          <button
            type="button"
            className="ar-abandon"
            data-confirming={confirming}
            data-no-flow
            onClick={() => (confirming ? abandonRun() : setConfirming(true))}
          >
            {confirming ? 'Confirmar saída' : 'Sair'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
