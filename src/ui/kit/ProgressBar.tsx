import { useId } from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Visible label above the bar. Without it, pass ariaLabel. */
  label?: string;
  ariaLabel?: string;
  /** Replaces the percentage on the right, for example "7/10". */
  valueLabel?: string;
  /** Pixel look: the bar is split in discrete cells instead of filling smoothly. */
  segmented?: boolean;
  segments?: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  size?: 'sm' | 'md';
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function ProgressBar({
  value,
  max = 100,
  label,
  ariaLabel,
  valueLabel,
  segmented = false,
  segments = 20,
  tone = 'accent',
  size = 'md',
}: ProgressBarProps) {
  const labelId = useId();
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const fraction = clamp01(value / limit);
  const cells = Math.max(2, Math.floor(segments));
  const filled = fraction >= 1 ? cells : Math.floor(fraction * cells);

  return (
    <div className="ui-progress" data-tone={tone} data-size={size}>
      {label ? (
        <div className="ui-progress-label">
          <span id={labelId}>{label}</span>
          <span>{valueLabel ?? `${Math.round(fraction * 100)}%`}</span>
        </div>
      ) : null}
      <div
        className="ui-progress-track"
        role="progressbar"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(limit, Math.max(0, Number.isFinite(value) ? value : 0))}
        aria-valuetext={valueLabel}
        data-segmented={segmented}
      >
        {segmented ? (
          Array.from({ length: cells }, (_, index) => <i key={index} data-on={index < filled} />)
        ) : (
          <div className="ui-progress-fill" style={{ width: `${fraction * 100}%` }} />
        )}
      </div>
    </div>
  );
}
