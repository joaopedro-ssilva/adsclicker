interface HpBarProps {
  hp: number;
  maxHp: number;
  tone: 'player' | 'enemy' | 'boss';
  /** Print "hp/max" inside the bar. */
  numbers?: boolean;
  label: string;
}

/** A health bar that drains in whole-pixel steps. The text is for reading it quickly, the label for screen readers. */
export function HpBar({ hp, maxHp, tone, numbers = false, label }: HpBarProps) {
  const fraction = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
  const low = fraction <= 0.3;
  return (
    <div
      className="ar-hp"
      data-tone={tone}
      data-low={low}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(maxHp)}
      aria-valuenow={Math.round(hp)}
    >
      <div className="ar-hp-fill" style={{ width: `${fraction * 100}%` }} />
      {numbers ? (
        <span className="ar-hp-text" aria-hidden="true">
          {Math.ceil(hp)}/{Math.round(maxHp)}
        </span>
      ) : null}
    </div>
  );
}
