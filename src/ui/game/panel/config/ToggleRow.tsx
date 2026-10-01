import { useId } from 'react';

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}

/** A labelled checkbox row: the whole row is the touch target. */
export function ToggleRow({ label, hint, checked, onChange, testId }: ToggleRowProps) {
  const id = useId();
  return (
    <label className="setting-row" htmlFor={id}>
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint ? <span className="setting-hint">{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" checked={checked} data-qa={testId} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
