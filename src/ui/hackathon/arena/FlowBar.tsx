'use client';
import { TICK_MS } from '@/hackathon/engine';
import type { ActiveRun } from '../store';
import { useHackathon } from '../store';

interface FlowBarProps {
  run: ActiveRun;
}

/** The Flow bar: clicks (or Space) fill it; when full, the next hit is a guaranteed crit. Also a big tap target on phones. */
export function FlowBar({ run }: FlowBarProps) {
  const flowClick = useHackathon((store) => store.flowClick);
  const { flowCharge, state } = run;
  const { player } = state;
  const full = flowCharge >= 1;
  const waitMs = Math.max(0, (player.flowAvailableAt - state.tick) * TICK_MS);

  let caption = 'Clique na arena para carregar o Fluxo';
  let mode: 'charging' | 'full' | 'armed' | 'waiting' = 'charging';
  if (player.flowReady) {
    mode = 'armed';
    caption = 'Próximo golpe crítico!';
  } else if (full && waitMs > 0) {
    mode = 'waiting';
    caption = `Fluxo carregado: dispara em ${(waitMs / 1000).toFixed(1).replace('.', ',')}s`;
  } else if (flowCharge > 0) {
    caption = 'Continue clicando!';
  }

  return (
    <button
      type="button"
      className="ar-flow"
      data-mode={mode}
      data-no-flow
      aria-label={`Fluxo: ${Math.round(flowCharge * 100)}%. ${caption}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        flowClick();
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
      }}
    >
      <span className="ar-flow-head">
        <span className="ar-flow-label">
          <span aria-hidden="true">⚡</span> Fluxo
        </span>
        <span className="ar-flow-caption">{caption}</span>
      </span>
      <span className="ar-flow-track" aria-hidden="true">
        <i style={{ width: `${Math.min(1, flowCharge) * 100}%` }} />
      </span>
    </button>
  );
}
