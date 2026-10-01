import { useId } from 'react';

interface VolumeRowProps {
  label: string;
  /** 0..1 */
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Called when the player lets go of the slider, to play a sample at the new volume. */
  onCommit?: () => void;
  testId?: string;
}

export function VolumeRow({ label, value, disabled = false, onChange, onCommit, testId }: VolumeRowProps) {
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="setting-row" data-disabled={disabled}>
      <label className="setting-text" htmlFor={id}>
        <span className="setting-label">{label}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        data-qa={testId}
        aria-valuetext={`${percent}%`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      <output className="setting-value" htmlFor={id}>
        {percent}%
      </output>
    </div>
  );
}
