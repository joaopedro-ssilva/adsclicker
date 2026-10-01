'use client';
import { memo } from 'react';
import type { ProfessorId } from '@/game/content/types';
import { Button, Icon, ProgressBar } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { HeadPortrait } from './HeadPortrait';

export interface RosterSlotProps {
  id: ProfessorId;
  name: string;
  color: string;
  state: 'active' | 'hired' | 'next' | 'locked';
  /** Formatted hire cost, for the next professor. */
  cost: string;
  /** 0..100 progress of the coins towards the cost. */
  progress: number;
  affordable: boolean;
  /** Why the next professor cannot be hired yet, when it is not a matter of coins. */
  lockReason: string | null;
  onSelect: (id: ProfessorId) => void;
  onHire: (id: ProfessorId) => void;
}

function HiredSlot({ id, name, color, state, onSelect }: RosterSlotProps) {
  return (
    <button
      type="button"
      className="roster-slot"
      data-state={state}
      data-qa={`roster-${id}`}
      style={cssVariables({ '--prof': color })}
      aria-pressed={state === 'active'}
      aria-label={state === 'active' ? `${name}, selecionado` : `Selecionar ${name}`}
      onClick={() => onSelect(id)}
    >
      <span className="roster-face">
        <HeadPortrait professorId={id} fallback={name} />
      </span>
      <span className="roster-name">{name}</span>
    </button>
  );
}

function NextSlot({ id, name, color, cost, progress, affordable, lockReason, onHire }: RosterSlotProps) {
  return (
    <div className="roster-slot roster-next" data-state="next" data-affordable={affordable} data-qa={`roster-${id}`} style={cssVariables({ '--prof': color })}>
      <span className="roster-face" data-dim>
        <HeadPortrait professorId={id} fallback={name} />
      </span>
      <div className="roster-offer">
        <span className="roster-name">{name}</span>
        {lockReason ? (
          <p className="roster-lock">
            <Icon name="lock" size={12} /> {lockReason}
          </p>
        ) : (
          <>
            <p className="roster-cost">
              <Icon name="coin" size={12} /> {cost}
            </p>
            <ProgressBar value={progress} max={100} ariaLabel={`ADScoins para contratar ${name}`} size="sm" tone={affordable ? 'good' : 'accent'} />
            <Button size="sm" disabled={!affordable} onClick={() => onHire(id)} data-qa={`hire-${id}`} aria-label={`Contratar ${name} por ${cost} ADScoins`}>
              Contratar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function LockedSlot({ id }: RosterSlotProps) {
  return (
    <div className="roster-slot" data-state="locked" data-qa={`roster-${id}`} aria-label="Professor ainda bloqueado">
      <span className="roster-face" data-silhouette>
        <HeadPortrait professorId={id} fallback="?" />
      </span>
      <span className="roster-name">???</span>
    </div>
  );
}

export const RosterSlot = memo(function RosterSlot(props: RosterSlotProps) {
  if (props.state === 'next') return <NextSlot {...props} />;
  if (props.state === 'locked') return <LockedSlot {...props} />;
  return <HiredSlot {...props} />;
});
