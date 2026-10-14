'use client';
import { useCallback, useMemo } from 'react';
import { useAbilityViews, useGame, useHasFeature } from '@/game/store';
import { AbilityButton } from './AbilityButton';
import { LayerReveal } from './LayerReveal';

/** Guto's layer: the unlocked abilities as buttons with cooldown rings. Keys 1 to 4 press them (see ShortcutsHost). */
export function Abilities() {
  const hasFeature = useHasFeature('abilities');
  const views = useAbilityViews();
  const activate = useGame((store) => store.useAbility);
  const unlocked = useMemo(() => views.filter((view) => view.unlocked), [views]);

  const press = useCallback((id: string) => void activate(id), [activate]);

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
