import { useCallback } from 'react';
import { content, useGame } from '@/game/store';
import { SceneryCard } from './SceneryCard';

export function SceneriesSection() {
  const owned = useGame((store) => store.state.sceneries);
  const equipped = useGame((store) => store.state.equippedScenery);
  const equipScenery = useGame((store) => store.equipScenery);
  const equip = useCallback((id: string) => equipScenery(id), [equipScenery]);

  return (
    <div className="album-scenery-grid">
      {content.sceneries.map((scenery) => (
        <SceneryCard
          key={scenery.id}
          scenery={scenery}
          owned={owned[scenery.id] === true}
          equipped={equipped === scenery.id}
          onEquip={equip}
        />
      ))}
    </div>
  );
}
