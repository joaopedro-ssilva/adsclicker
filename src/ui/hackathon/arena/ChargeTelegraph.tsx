import { TICK_MS } from '@/hackathon/engine';
import { cssVariables } from '@/ui/theme';

interface ChargeTelegraphProps {
  /** Ticks left before the hit lands. */
  ticksLeft: number;
  /** Total ticks of the wind-up (the enemy's `windupMs`). */
  totalTicks: number;
  /** The student has a block up: the hit will be negated. */
  covered: boolean;
}

/** The warning over an enemy that is charging a heavy hit: how long is left, and what to do about it. */
export function ChargeTelegraph({ ticksLeft, totalTicks, covered }: ChargeTelegraphProps) {
  const left = Math.max(0, ticksLeft);
  const progress = totalTicks > 0 ? Math.min(1, Math.max(0, 1 - left / totalTicks)) : 1;
  const seconds = ((left * TICK_MS) / 1000).toFixed(1).replace('.', ',');
  return (
    <div className="ar-charge" data-covered={covered} style={cssVariables({ '--p': String(progress) })}>
      <p className="ar-charge-label">
        <span aria-hidden="true">⚠</span> {covered ? 'Bloqueio pronto' : 'Golpe forte!'}
      </p>
      <p className="ar-charge-time">{seconds}s</p>
      <div className="ar-charge-bar" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
