'use client';
import { ASSETS } from '@/ui/art/manifest';
import type { HeadDef } from '@/hackathon/content';
import { cssVariables } from '@/ui/theme';

interface HeadOptionProps {
  head: HeadDef;
  selected: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}

/** One of the twelve heads, drawn at 2x so each is recognisable at a glance. */
export function HeadOption({ head, selected, disabled, onPick }: HeadOptionProps) {
  const meta = ASSETS[head.asset];
  return (
    <button
      type="button"
      className="ar-head-option"
      aria-pressed={selected}
      aria-label={head.name}
      title={head.name}
      disabled={disabled}
      onClick={() => onPick(head.id)}
    >
      <span
        className="ar-sprite"
        aria-hidden="true"
        style={{ ...cssVariables({ '--w': String(meta?.w ?? 45), '--h': String(meta?.h ?? 56) }), backgroundImage: `url(/assets/${head.asset}.png)` }}
      />
    </button>
  );
}
