'use client';
import { memo } from 'react';
import { formatDuration } from '@/game/engine/format';
import type { AbilityView } from '@/game/store';
import { Keycap, Meter, Tooltip } from '@/ui/kit';

interface AbilityButtonProps {
  ability: AbilityView;
  /** 1-based position, also the keyboard shortcut. */
  slot: number;
  onUse: (id: string) => void;
}

/** One ability: a radial cooldown ring around its emoji. Ready, running (the ring drains) or recharging. */
export const AbilityButton = memo(
  function AbilityButton({ ability, slot, onUse }: AbilityButtonProps) {
    const running = ability.activeLeftMs > 0;
    const ready = !running && ability.cooldownLeftMs <= 0;
    const state = running ? 'running' : ready ? 'ready' : 'cooldown';
    const value = running ? ability.activeLeftMs : ability.cooldownMs - ability.cooldownLeftMs;
    const max = running ? Math.max(ability.activeLeftMs, ability.cooldownMs * 0.1) : ability.cooldownMs;
    const caption = running ? formatDuration(ability.activeLeftMs) : ready ? 'Pronto' : formatDuration(ability.cooldownLeftMs);

    return (
      <Tooltip content={`${ability.name}: ${ability.description}`}>
        <button
          type="button"
          className="ability"
          data-qa={`ability-${ability.id}`}
          data-state={state}
          disabled={!ready}
          onClick={() => onUse(ability.id)}
          aria-label={`${ability.name}, ${caption}`}
        >
          <Meter value={value} max={max} label={ability.name} size="md" showLabel={false}>
            <span aria-hidden="true">{ability.emoji}</span>
          </Meter>
          <span className="ability-name">{ability.name}</span>
          <span className="ability-caption">{caption}</span>
          <span className="ability-key" aria-hidden="true">
            <Keycap>{slot}</Keycap>
          </span>
        </button>
      </Tooltip>
    );
  },
  (previous, next) =>
    previous.slot === next.slot &&
    previous.onUse === next.onUse &&
    previous.ability.id === next.ability.id &&
    previous.ability.unlocked === next.ability.unlocked &&
    previous.ability.cooldownLeftMs <= 0 === next.ability.cooldownLeftMs <= 0 &&
    previous.ability.activeLeftMs <= 0 === next.ability.activeLeftMs <= 0 &&
    Math.round(previous.ability.cooldownLeftMs / 250) === Math.round(next.ability.cooldownLeftMs / 250) &&
    Math.round(previous.ability.activeLeftMs / 250) === Math.round(next.ability.activeLeftMs / 250),
);
