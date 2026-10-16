'use client';
import type { ReactNode } from 'react';
import type { LabCosmeticEntry } from '@/game/engine/views';
import { Icon } from '@/ui/kit';
import { ItemArt } from './ItemArt';

/** The picture of a cosmetic: a mini frame for a skin, a three-colour chip for a theme, the art for an object. */
export function CosmeticThumb({ entry, size = 56 }: { entry: LabCosmeticEntry; size?: number }) {
  if (entry.kind === 'monitor') {
    return (
      <span
        className="lab-thumb lab-thumb-monitor"
        data-skin={entry.id}
        style={{ width: size * 1.3, height: size }}
        role="img"
        aria-label={entry.name}
      >
        <i />
      </span>
    );
  }
  if (entry.kind === 'theme') {
    return (
      <span
        className="lab-thumb lab-thumb-theme"
        data-lab-theme={entry.id}
        style={{ width: size * 1.3, height: size }}
        role="img"
        aria-label={entry.name}
      >
        <i />
        <b />
      </span>
    );
  }
  return entry.art ? <ItemArt asset={entry.art} name={entry.name} size={size} /> : null;
}

interface CosmeticCardProps {
  entry: LabCosmeticEntry;
  /** The line under the name: the effect of a starting item, or the description. */
  note?: string;
  /** What the card says it is when the player does not have it: the price, or how to get it. */
  lock: ReactNode;
  /** The button(s) at the end. */
  actions: ReactNode;
  /** Shows the picture or hover in the preview. */
  onPreview?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  selected?: boolean;
  /** Hides what it is (name, description, picture) while it is not owned: only how to get it shows. */
  mask?: boolean;
}

/** One cosmetic as the wardrobe and the shop list it. */
export function CosmeticCard({ entry, note, lock, actions, onPreview, onSelect, selected, mask }: CosmeticCardProps) {
  const hidden = mask && !entry.owned;
  return (
    <li
      className="lab-cosm-card"
      data-owned={entry.owned || undefined}
      data-equipped={entry.equipped || undefined}
      data-selected={selected || undefined}
      data-qa={`lab-cosmetic-${entry.id}`}
      onPointerEnter={() => onPreview?.(entry.id)}
      onPointerLeave={() => onPreview?.(null)}
      onFocus={() => onPreview?.(entry.id)}
      onBlur={() => onPreview?.(null)}
    >
      <button
        type="button"
        className="lab-cosm-pick"
        onClick={() => onSelect?.(entry.id)}
        aria-label={hidden ? 'Cosmético bloqueado' : `Ver ${entry.name}`}
        tabIndex={onSelect ? 0 : -1}
      >
        {hidden ? (
          <span className="lab-thumb lab-thumb-locked" role="img" aria-label="Bloqueado">
            <Icon name="lock" size={22} />
          </span>
        ) : (
          <CosmeticThumb entry={entry} />
        )}
      </button>
      <div className="lab-cosm-body">
        <p className="lab-cosm-name">{hidden ? '???' : entry.name}</p>
        <p className="lab-cosm-note">{hidden ? 'Bloqueado' : (note ?? entry.description)}</p>
        <p className="lab-cosm-state">
          {entry.equipped ? (
            <span className="lab-cosm-badge" data-tone="on">
              Em uso
            </span>
          ) : entry.owned ? (
            <span className="lab-cosm-badge">Seu</span>
          ) : (
            <span className="lab-cosm-lock">
              <Icon name="lock" size={12} /> {lock}
            </span>
          )}
        </p>
      </div>
      <div className="lab-cosm-actions">{actions}</div>
    </li>
  );
}
