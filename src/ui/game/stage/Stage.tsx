'use client';
import { useEffect } from 'react';
import { content, useGameState } from '@/game/store';
import { Scenery } from '@/ui/art/Scenery';
import { cssVariables } from '@/ui/theme';
import { useUi } from '../shared/uiStore';
import { registerAnchor } from '../wiring/stageRefs';
import { Abilities } from './Abilities';
import { Actor } from './Actor';
import { BuffChips } from './BuffChips';
import { InvasionLayer } from './InvasionLayer';
import { BolsaPanel } from './maestria/bolsa/BolsaPanel';
import { FestaLayer } from './maestria/FestaLayer';
import { MaestriaDock } from './maestria/MaestriaDock';
import { ReleaseTag } from './maestria/ReleaseTag';
import { PhotoExit } from './PhotoExit';
import { SwarmLayer } from './maestria/SwarmLayer';
import { SwarmSummary } from './maestria/SwarmSummary';
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
  const photo = useUi((store) => store.photo);
  // Photo mode measures like the normal stage, so the professor keeps the size it had.
  const { ref, scale } = useStageScale(reservedHeight);

  useEffect(() => {
    registerAnchor('stage', ref.current);
    return () => registerAnchor('stage', null);
  }, [ref]);

  if (!scenery) return null;
  if (photo) {
    // Photo mode: the scenery, its ambient particles, the professor (and the mythic aura) and the way out. The game runs on.
    return (
      <section className="stage-root" aria-label="Palco" ref={ref} data-photo="on">
        <Scenery scenery={scenery} focusY={0.65} className="stage-scenery">
          <div className="stage-ui" data-photo="on" style={cssVariables({ '--scale': String(scale) })}>
            <div className="stage-play">
              <Actor scale={scale} photo />
            </div>
            <PhotoExit />
          </div>
        </Scenery>
      </section>
    );
  }
  return (
    <section className="stage-root" aria-label="Palco" ref={ref}>
      <Scenery scenery={scenery} focusY={0.65} className="stage-scenery">
        <div className="stage-ui" style={cssVariables({ '--scale': String(scale) })}>
          <StageHeader />
          <div className="stage-play">
            <div className="stage-left">
              <SprintCard />
              <ReleaseTag />
              <BuffChips />
            </div>
            <div className="stage-right">
              <Abilities />
            </div>
            <MaestriaDock />
            <Actor scale={scale} />
            <InvasionLayer />
            <SwarmLayer />
            <FestaLayer />
          </div>
          <Roster />
        </div>
        <SwarmSummary />
        <BolsaPanel />
      </Scenery>
    </section>
  );
}
