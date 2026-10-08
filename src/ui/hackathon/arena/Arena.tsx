'use client';
import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { cssVariables } from '@/ui/theme';
import { useHackathon } from '../store';
import type { ActiveRun } from '../store';
import { ArenaControls } from './ArenaControls';
import { ArenaEffects } from './ArenaEffects';
import { ChoiceCards } from './ChoiceCards';
import { EndBanner } from './EndBanner';
import { EnemyLayer } from './EnemyLayer';
import { EnemyPanel } from './EnemyPanel';
import { PlayerActor } from './PlayerActor';
import { PlayerPanel } from './PlayerPanel';
import { useArenaKeys } from './useArenaKeys';
import { useArenaScale } from './useArenaScale';

interface ArenaProps {
  run: ActiveRun;
}

/** A fight over the whole screen: the health panels, the student on the left, the wave on the right, and the controls. */
export function Arena({ run }: ArenaProps) {
  const flowClick = useHackathon((store) => store.flowClick);
  const root = useRef<HTMLDivElement>(null);
  const { ref: play, scale } = useArenaScale(run.stage);
  useArenaKeys();

  const { state } = run;
  const over = state.phase === 'won' || state.phase === 'lost';
  const charging = state.enemies.some((enemy) => enemy.chargeLandsAt !== null);

  // Any tap on the arena charges the Flow; buttons keep their own meaning.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button, [data-no-flow]')) return;
    flowClick();
  };

  return (
    <div className="ar-arena" ref={root} data-phase={state.phase} data-charging={charging} style={cssVariables({ '--zoom': String(scale) })}>
      <div className="ar-vs" onPointerDown={onPointerDown}>
        <PlayerPanel player={state.player} tick={state.tick} />
        <span className="ar-vs-mark" aria-hidden="true">
          VS
        </span>
        <EnemyPanel enemies={state.enemies} />
      </div>
      <div className="ar-play" ref={play} onPointerDown={onPointerDown}>
        <div className="ar-field">
          <PlayerActor player={state.player} tick={state.tick} scale={scale} />
          <EnemyLayer state={state} scale={scale} />
        </div>
        {state.phase === 'choosing' && state.offer ? <ChoiceCards offer={state.offer} auto={run.auto} /> : null}
        {over ? <EndBanner won={state.phase === 'won'} timeout={state.phase === 'lost' && state.player.hp > 0} error={run.finishError} /> : null}
      </div>
      <ArenaControls run={run} />
      <div className="ar-vignette" aria-hidden="true" />
      <div className="ar-danger" aria-hidden="true" />
      <ArenaEffects root={root} scale={scale} />
    </div>
  );
}
