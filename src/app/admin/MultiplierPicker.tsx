'use client';
import { useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { multiplierSchema } from '@/shared/api';
import { Button } from '@/ui/kit';

interface MultiplierPickerProps {
  presets: readonly number[];
  /** Highlights the preset equal to the value in force. */
  current: number;
  busy: boolean;
  onApply: (value: number) => void;
  /** Adds a free-form value field. */
  custom?: boolean;
  /** Prefix of ids and of the data-qa hooks. */
  name: string;
}

/** Preset buttons and an optional custom value. Validation mirrors the API's limits. */
export function MultiplierPicker({ presets, current, busy, onApply, custom = false, name }: MultiplierPickerProps) {
  const [text, setText] = useState('');
  const parsed = multiplierSchema.safeParse(Number(text.trim().replace(',', '.')));
  const valid = text.trim() !== '' && parsed.success;

  return (
    <div className="admin-picker">
      <div className="admin-presets" role="group" aria-label="Multiplicadores prontos">
        {presets.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={current === value ? 'primary' : 'secondary'}
            aria-pressed={current === value}
            disabled={busy}
            data-qa={`${name}-x${value}`}
            onClick={() => onApply(value)}
          >
            ×{formatNumber(value)}
          </Button>
        ))}
      </div>
      {custom ? (
        <form
          className="admin-custom"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && parsed.success) onApply(parsed.data);
          }}
        >
          <label htmlFor={`${name}-custom`}>Outro</label>
          <input
            id={`${name}-custom`}
            inputMode="decimal"
            placeholder="0,1 a 1.000.000"
            value={text}
            aria-invalid={text.trim() !== '' && !valid}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={!valid || busy} data-qa={`${name}-apply`}>
            Aplicar
          </Button>
        </form>
      ) : null}
    </div>
  );
}
