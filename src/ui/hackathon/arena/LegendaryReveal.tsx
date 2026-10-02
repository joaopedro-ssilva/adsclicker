'use client';
import { useEffect } from 'react';
import type { ItemInstance } from '@/hackathon/engine';
import { fx } from '@/ui/fx';
import { audio } from '@/ui/audio';
import { SceneOverlay } from '@/ui/game/moments/SceneOverlay';
import { Button } from '@/ui/kit';
import { ItemSprite } from '../shared/ItemSprite';
import { itemBaseById } from '../shared/lookup';
import { affixText } from '../shared/stats';

interface LegendaryRevealProps {
  item: ItemInstance;
  onClose: () => void;
}

/** A legendary drop takes the whole screen. */
export function LegendaryReveal({ item, onClose }: LegendaryRevealProps) {
  const base = itemBaseById.get(item.base);

  useEffect(() => {
    audio.play('graduate');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const timers = [
      setTimeout(() => fx.confetti({ x: w * 0.5, y: h * 0.35, count: 120 }), 350),
      setTimeout(() => fx.sparkles({ x: w * 0.5, y: h * 0.45, count: 60, color: '#f7ca75' }), 650),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <SceneOverlay label={`Item lendário: ${base?.name ?? ''}`} accent="#f7ca75" variant="legendary" onClose={onClose}>
      <div className="ar-legend">
        <p className="scene-kicker">Item lendário!</p>
        <div className="ar-legend-art">
          <ItemSprite asset={base?.asset ?? ''} scale={7} />
        </div>
        <h3 className="scene-title">{base?.name ?? item.base}</h3>
        <ul className="ar-legend-affixes">
          {item.affixes.map((affix) => (
            <li key={`${affix.target}-${affix.op}`}>{affixText(affix)}</li>
          ))}
        </ul>
        {base ? <p className="ar-legend-unique">{base.unique.description}</p> : null}
        <div className="scene-actions">
          <Button size="lg" onClick={onClose}>
            Incrível!
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
