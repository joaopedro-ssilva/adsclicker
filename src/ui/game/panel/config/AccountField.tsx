import { useId } from 'react';

interface AccountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  autoComplete: string;
  hint?: string;
  error?: string | null;
  maxLength: number;
  testId: string;
}

/** A labelled text input with an optional hint and an inline error under it. */
export function AccountField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  hint,
  error,
  maxLength,
  testId,
}: AccountFieldProps) {
  const id = useId();
  return (
    <div className="account-field">
      <label htmlFor={id} className="setting-label">
        {label}
      </label>
      <input
        id={id}
        className="text-input account-input"
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        data-qa={testId}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className="save-warning" data-tone="bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="setting-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
