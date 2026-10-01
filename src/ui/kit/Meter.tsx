import type { ReactNode } from 'react';
import { cssVariables } from '../theme';
import { ProgressBar } from './ProgressBar';

export interface MeterProps {
  value: number;
  max?: number;
  label: string;
  /** Radial is an octagonal ring that fills clockwise in 24 steps (cooldowns); bar is the segmented progress bar. */
  variant?: 'radial' | 'bar';
  size?: 'sm' | 'md' | 'lg';
  /** Content in the centre of the radial ring, for example an emoji. Defaults to the percentage. */
  children?: ReactNode;
  /** Show the label under the radial ring. */
  showLabel?: boolean;
}

const STEPS = 24;

export function Meter({ value, max = 100, label, variant = 'radial', size = 'md', children, showLabel = true }: MeterProps) {
  if (variant === 'bar') return <ProgressBar value={value} max={max} label={label} segmented />;

  const fraction = Number.isFinite(value) && max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const percent = Math.round(fraction * 100);
  const stepped = (Math.round(fraction * STEPS) / STEPS) * 100;

  return (
    <div className="ui-meter" data-size={size}>
      <div
        className="ui-meter-ring"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-full={fraction >= 1}
        style={cssVariables({ '--meter-fill': `${stepped}%` })}
      >
        <span className="ui-meter-center">{children ?? <span className="ui-meter-value">{percent}</span>}</span>
      </div>
      {showLabel ? <p className="ui-meter-label">{label}</p> : null}
    </div>
  );
}
