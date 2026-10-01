import type { ReactNode } from 'react';
import type { SceneryDef } from '@/game/content/types';
import { Scenery } from '@/ui/art/Scenery';
import { Badge } from '@/ui/kit';
import { ambientLabels } from '../data';

/** A scenery with its name and ambient labelled on top. Children (a character, for example) stand on the floor. */
export function SceneryCard({ scenery, children }: { scenery: SceneryDef; children?: ReactNode }) {
  return (
    <Scenery scenery={scenery} className="scenery-card">
      <div className="scenery-card-label">
        <Badge>{scenery.name}</Badge>
        <Badge tone="accent">{ambientLabels[scenery.ambient]}</Badge>
      </div>
      {children}
    </Scenery>
  );
}
