'use client';
import { useId, useState } from 'react';
import type { AdminTagCreate } from '@/shared/api';
import type { TagVisibility } from '@/shared/tags';
import { TAG_COLOR_PATTERN, TAG_COLOR_PRESETS, TAG_DESCRIPTION_MAX, TAG_LABEL_MAX } from '@/shared/tags';
import { Button } from '@/ui/kit';
import { TagBadge } from '@/ui/game/panel/comunidade/TagBadge';

interface TagFormProps {
  /** The values to start from: a tag being edited, or the defaults of a new one. */
  initial: AdminTagCreate;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: AdminTagCreate) => void;
  onCancel?: () => void;
}

export const NEW_TAG: AdminTagCreate = { label: '', description: '', color: TAG_COLOR_PRESETS[2], visibility: 'public', single: false };

/** Name, description, colour, who sees it and single holder, with a live preview of the badge. */
export function TagForm({ initial, submitLabel, busy, onSubmit, onCancel }: TagFormProps) {
  const id = useId();
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description ?? '');
  const [color, setColor] = useState(initial.color);
  const [visibility, setVisibility] = useState<TagVisibility>(initial.visibility);
  const [single, setSingle] = useState(initial.single ?? false);

  const validColor = TAG_COLOR_PATTERN.test(color);
  const valid = label.trim().length > 0 && validColor;

  return (
    <form
      className="admin-tag-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit({ label: label.trim(), description: description.trim(), color, visibility, single });
      }}
    >
      <div className="admin-tag-fields">
        <label htmlFor={`${id}-label`}>Nome</label>
        <input
          id={`${id}-label`}
          value={label}
          maxLength={TAG_LABEL_MAX}
          placeholder="Ex.: Campeão do Semestre"
          required
          data-qa="admin-tag-label"
          onChange={(event) => setLabel(event.target.value)}
        />

        <label htmlFor={`${id}-description`}>Descrição</label>
        <input
          id={`${id}-description`}
          value={description}
          maxLength={TAG_DESCRIPTION_MAX}
          placeholder="Aparece ao passar o mouse sobre a tag"
          data-qa="admin-tag-description"
          onChange={(event) => setDescription(event.target.value)}
        />

        <span className="admin-tag-field-label">Cor</span>
        <div className="admin-tag-colors">
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="admin-tag-swatch"
              style={{ background: preset }}
              aria-label={`Cor ${preset}`}
              aria-pressed={color === preset}
              onClick={() => setColor(preset)}
            />
          ))}
          <input
            type="color"
            aria-label="Escolher outra cor"
            value={validColor ? color : '#000000'}
            data-qa="admin-tag-color"
            onChange={(event) => setColor(event.target.value.toLowerCase())}
          />
          <input
            className="admin-tag-hex"
            aria-label="Cor em hexadecimal"
            aria-invalid={!validColor}
            value={color}
            maxLength={7}
            onChange={(event) => setColor(event.target.value.trim().toLowerCase())}
          />
        </div>

        <span className="admin-tag-field-label">Quem vê</span>
        <div className="admin-tag-choice" role="radiogroup" aria-label="Quem vê a tag">
          <label>
            <input type="radio" name={`${id}-visibility`} checked={visibility === 'public'} onChange={() => setVisibility('public')} />
            Todos (ranking, mural e o próprio jogador)
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-visibility`}
              checked={visibility === 'admin'}
              data-qa="admin-tag-admin-only"
              onChange={() => setVisibility('admin')}
            />
            Só a tela de admin
          </label>
        </div>

        <span className="admin-tag-field-label">Exclusiva</span>
        <label className="admin-tag-check">
          <input type="checkbox" checked={single} onChange={(event) => setSingle(event.target.checked)} />
          Só um jogador pode ter
        </label>
      </div>

      <div className="admin-tag-preview">
        <span className="admin-tag-field-label">Prévia</span>
        <TagBadge
          tags={[{ id: 'preview', label: label.trim() || 'Nome da tag', description, color: validColor ? color : '#888888', adminOnly: visibility === 'admin' }]}
        />
      </div>

      <div className="admin-action-buttons">
        <Button type="submit" size="sm" variant="primary" disabled={busy || !valid} data-qa="admin-tag-submit">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
