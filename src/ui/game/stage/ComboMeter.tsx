'use client';
import { useCombo } from '@/game/store';
import { cssVariables } from '@/ui/theme';
import { LayerReveal } from './LayerReveal';

const MAX_CELLS = 20;

function heatOf(fraction: number): 0 | 1 | 2 | 3 {
  if (fraction >= 0.8) return 3;
  if (fraction >= 0.5) return 2;
  if (fraction >= 0.2) return 1;
  return 0;
}

const times = (value: number) => `×${value.toFixed(2).replace('.', ',')}`;

/**
 * A pixel thermometer beside the professor: it fills as the combo builds and goes from the accent colour
 * through yellow and orange to red, with a flame when it is full.
 */
export function ComboMeter() {
  const combo = useCombo();
  if (!combo.unlocked) return null;

  const cells = Math.max(4, Math.min(MAX_CELLS, combo.max));
  const fraction = combo.max > 0 ? Math.min(1, combo.steps / combo.max) : 0;
  const filled = Math.round(fraction * cells);
  const full = combo.max > 0 && combo.steps >= combo.max;

  return (
    <LayerReveal layer="combo" className="combo-slot">
      <div
        className="combo"
        data-heat={heatOf(fraction)}
        data-full={full}
        data-idle={combo.steps === 0}
        role="meter"
        aria-label="Combo de cliques"
        aria-valuemin={0}
        aria-valuemax={combo.max}
        aria-valuenow={combo.steps}
        aria-valuetext={`${combo.steps} de ${combo.max}, ${times(combo.multiplier)}`}
      >
        <p className="combo-multiplier">
          {full ? <span aria-hidden="true">🔥</span> : null}
          {times(combo.multiplier)}
        </p>
        <div className="combo-cells" style={cssVariables({ '--cells': String(cells) })}>
          {Array.from({ length: cells }, (_, index) => (
            <i key={index} data-on={cells - index <= filled} style={cssVariables({ '--n': String((cells - index) / cells) })} />
          ))}
        </div>
        <p className="combo-label">
          Combo <b>{combo.steps}</b>/{combo.max}
        </p>
      </div>
    </LayerReveal>
  );
}
