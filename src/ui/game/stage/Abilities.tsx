'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { abilityViews } from '@/game/engine/views';
import { content, useAbilityViews, useGame, useHasFeature } from '@/game/store';
import { AbilityButton } from './AbilityButton';
import { LayerReveal } from './LayerReveal';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

/** Guto's layer: the unlocked abilities as buttons with cooldown rings. Keys 1 to 4 press them. */
export function Abilities() {
  const hasFeature = useHasFeature('abilities');
  const views = useAbilityViews();
  const activate = useGame((store) => store.useAbility);
  const unlocked = useMemo(() => views.filter((view) => view.unlocked), [views]);

  const press = useCallback((id: string) => void activate(id), [activate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
      const slot = Number(event.key);
      // Read the live state: the listener is attached once, not on every tick.
      const live = abilityViews(useGame.getState().state, content, Date.now()).filter((view) => view.unlocked);
      const ability = Number.isInteger(slot) ? live[slot - 1] : undefined;
      if (ability && ability.cooldownLeftMs <= 0 && ability.activeLeftMs <= 0) press(ability.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (!hasFeature && unlocked.length === 0) return null;
  return (
    <LayerReveal layer="abilities" className="abilities-slot">
      <div className="abilities" role="group" aria-label="Habilidades">
        {unlocked.map((ability, index) => (
          <AbilityButton key={ability.id} ability={ability} slot={index + 1} onUse={press} />
        ))}
      </div>
    </LayerReveal>
  );
}
