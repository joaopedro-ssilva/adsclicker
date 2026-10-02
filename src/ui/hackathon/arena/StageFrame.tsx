'use client';
import type { ReactNode } from 'react';
import { Scenery } from '@/ui/art/Scenery';
import { StageHeader } from '@/ui/game/stage/StageHeader';

const ARENA_SCENERY = {
  id: 'hackathon-arena',
  name: 'Laboratório',
  asset: 'hackathon/arenas/capitulo-1',
  palette: { sky: '#10142a', horizon: '#1c2440', floor: '#2b3156' },
};

interface StageFrameProps {
  /** Arena art key (StageDef.arena). Defaults to chapter 1. */
  arena?: string;
  children: ReactNode;
}

/** The Hackathon's side of the screen: the arena backdrop, the shared header and whatever the state shows. */
export function StageFrame({ arena, children }: StageFrameProps) {
  const scenery = arena ? { ...ARENA_SCENERY, asset: arena } : ARENA_SCENERY;
  return (
    <section className="stage-root ar-stage" aria-label="Arena do Hackathon">
      <Scenery scenery={scenery} focusY={0.9} className="stage-scenery">
        <div className="stage-ui ar-ui">
          <StageHeader />
          {children}
        </div>
      </Scenery>
    </section>
  );
}
