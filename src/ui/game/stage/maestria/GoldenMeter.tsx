'use client';
import { useJoinhaView } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import { cssVariables } from '@/ui/theme';
import { LayerReveal } from '../LayerReveal';

const CELLS = 10;

/**
 * Joinha de Ouro, beside the professor: how many manual clicks until the golden one. When it is ready the card
 * turns gold and says so; the professor glows too (see ClickerButton).
 */
export function GoldenMeter() {
  const view = useJoinhaView();
  if (!view) return null;

  const fraction = view.needed > 0 ? Math.min(1, view.clicks / view.needed) : 0;
  const filled = view.ready ? CELLS : Math.floor(fraction * CELLS);

  return (
    <LayerReveal layer="joinha" className="golden-slot">
      <div
        className="golden"
        data-ready={view.ready}
        data-qa="golden-meter"
        role="meter"
        aria-label="Joinha de Ouro"
        aria-valuemin={0}
        aria-valuemax={view.needed}
        aria-valuenow={view.clicks}
        aria-valuetext={view.ready ? 'O próximo clique é de ouro' : `${view.clicks} de ${view.needed} cliques`}
      >
        <p className="golden-title">
          <span aria-hidden="true">👍</span> {view.ready ? 'Ouro!' : 'Joinha'}
        </p>
        <div className="golden-cells" style={cssVariables({ '--cells': String(CELLS) })}>
          {Array.from({ length: CELLS }, (_, index) => (
            <i key={index} data-on={index < filled} />
          ))}
        </div>
        <p className="golden-label">
          {view.ready ? (
            <>Próximo clique vale {formatNumber(view.seconds, { integer: true })} s</>
          ) : (
            <>
              <b>{view.clicks}</b>/{view.needed}
            </>
          )}
        </p>
      </div>
    </LayerReveal>
  );
}
