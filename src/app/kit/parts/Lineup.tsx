'use client';
import { useState } from 'react';
import type { SkinDef } from '@/game/content/types';
import { Character } from '@/ui/art/Character';
import { RarityBadge } from '@/ui/kit';

export interface LineupProps {
  skins: SkinDef[];
  /** Use each professor's real head sprite. Without it the head is procedural too. */
  realHeads: boolean;
}

/** A row of skins you can click to play the squash animation. */
export function Lineup({ skins, realHeads }: LineupProps) {
  const [bumps, setBumps] = useState<Record<string, number>>({});

  return (
    <div className="lineup">
      {skins.map((skin) => (
        <button
          type="button"
          key={skin.id}
          className="lineup-item"
          aria-label={`Animar ${skin.name}`}
          onClick={() => setBumps((current) => ({ ...current, [skin.id]: (current[skin.id] ?? 0) + 1 }))}
        >
          <span className="lineup-stage">
            <Character
              body={skin.body}
              head={realHeads ? `heads/${skin.professor}` : undefined}
              hat={skin.hat}
              palette={skin.palette}
              seed={skin.id}
              scale={2}
              bump={bumps[skin.id] ?? 0}
              label={skin.name}
            />
          </span>
          <strong>{skin.name}</strong>
          <RarityBadge rarity={skin.rarity} />
        </button>
      ))}
    </div>
  );
}
