'use client';
import { useEffect } from 'react';
import { content, useGameState } from '@/game/store';
import { Scenery } from '@/ui/art/Scenery';
import { cssVariables } from '@/ui/theme';
import { registerAnchor } from '../wiring/stageRefs';
import { Abilities } from './Abilities';
import { Actor } from './Actor';
import { BuffChips } from './BuffChips';
import { InvasionLayer } from './InvasionLayer';
import { Roster } from './Roster';
import { SprintCard } from './SprintCard';
import { StageHeader } from './StageHeader';
import { useStageScale } from './useStageScale';

const sceneryById = new Map(content.sceneries.map((scenery) => [scenery.id, scenery]));
const FALLBACK_SCENERY = content.sceneries.find((scenery) => scenery.default) ?? content.sceneries[0];

/** Height the HUD takes around the professor: header (and balance), speech bubble, roster. */
function reservedHeight({ width }: { width: number; height: number }): number {
  return width < 640 ? 176 : 372;
}

/** The left side of the game screen: scenery, the professor and everything that happens around them. */
export function Stage() {
  const sceneryId = useGameState((state) => state.equippedScenery);
  const scenery = sceneryById.get(sceneryId) ?? FALLBACK_SCENERY;
  const { ref, scale } = useStageScale(reservedHeight);

  useEffect(() => {
    registerAnchor('stage', ref.current);
    return () => registerAnchor('stage', null);
  }, [ref]);

  if (!scenery) return null;
  return (
    <section className="stage-root" aria-label="Palco" ref={ref}>
      <Scenery scenery={scenery} focusY={0.65} className="stage-scenery">
        <div className="stage-ui" style={cssVariables({ '--scale': String(scale) })}>
          <StageHeader />
          <div className="stage-play">
            <div className="stage-left">
              <SprintCard />
              <BuffChips />
            </div>
            <div className="stage-right">
              <Abilities />
            </div>
            <Actor scale={scale} />
            <InvasionLayer />
          </div>
          <Roster />
        </div>
      </Scenery>
    </section>
  );
}
