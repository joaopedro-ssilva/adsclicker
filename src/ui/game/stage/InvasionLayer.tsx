'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, useGameEvents, useGameState, useHasFeature } from '@/game/store';
import type { ActiveInvasion } from '@/game/engine/state';
import { cssVariables } from '@/ui/theme';
import { invasionById } from '../wiring/describe';
import { registerAnchor } from '../wiring/stageRefs';

/** Octagon outline, 96 units wide, drawn so a dash pattern on pathLength 100 can drain clockwise. */
const OCTAGON = 'M30 2H66L94 30V66L66 94H30L2 66V30Z';
const GHOST_MS = 900;

interface Ghost {
  key: number;
  kind: 'defended' | 'missed';
  emoji: string;
  x: number;
  y: number;
}

const anchorRef = (node: HTMLButtonElement | null) => registerAnchor('invasion', node);

const position = (x: number, y: number) =>
  cssVariables({ '--x': `${(8 + x * 84).toFixed(2)}%`, '--y': `${(10 + y * 74).toFixed(2)}%` });

function ActiveThreat({ invasion }: { invasion: ActiveInvasion }) {
  const hit = useGame((store) => store.hitInvasion);
  const now = useGameState((state) => state.lastTickAt);
  const [startedAt] = useState(now);
  const def = invasionById.get(invasion.def);
  const secondsLeft = Math.max(0, Math.ceil((invasion.expiresAt - now) / 1000));
  const windowMs = invasion.expiresAt - invasion.spawnedAt;
  const elapsed = Math.max(0, startedAt - invasion.spawnedAt);

  if (!def) return null;
  return (
    <button
      type="button"
      className="invasion"
      data-qa="invasion"
      ref={anchorRef}
      style={{
        ...position(invasion.x, invasion.y),
        ...cssVariables({ '--window': `${windowMs}ms`, '--elapsed': `-${elapsed}ms` }),
      }}
      aria-label={`Invasão: ${def.name}. Clique ${invasion.clicksLeft} ${invasion.clicksLeft === 1 ? 'vez' : 'vezes'} para defender. ${secondsLeft} segundos restantes.`}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        hit();
      }}
      onClick={(event) => {
        if (event.detail === 0) hit();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="invasion-body" key={invasion.clicksLeft}>
        <svg className="invasion-ring" viewBox="0 0 96 96" aria-hidden="true">
          <path className="invasion-track" d={OCTAGON} pathLength="100" />
          <path className="invasion-drain" d={OCTAGON} pathLength="100" />
        </svg>
        <span className="invasion-emoji" aria-hidden="true">
          {def.emoji}
        </span>
        <span className="invasion-clicks" aria-hidden="true">
          ×{invasion.clicksLeft}
        </span>
      </span>
      <span className="invasion-label" aria-hidden="true">
        {def.name} · {secondsLeft} s
      </span>
    </button>
  );
}

/** The threat of Wagner's layer on the stage, plus the short exit animation when it is defended or escapes. */
export function InvasionLayer() {
  const enabled = useHasFeature('events');
  const invasion = useGameState((state) => state.invasion);
  const last = useRef<ActiveInvasion | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  useEffect(() => {
    if (invasion) last.current = invasion;
  }, [invasion]);

  useEffect(() => {
    if (!ghost) return;
    const timer = setTimeout(() => setGhost(null), GHOST_MS);
    return () => clearTimeout(timer);
  }, [ghost]);

  useGameEvents(
    (event) => {
      if (event.type !== 'invasionDefended' && event.type !== 'invasionMissed') return;
      const from = last.current;
      const emoji = invasionById.get(event.def)?.emoji;
      if (!from || !emoji) return;
      setGhost({ key: event.uid, kind: event.type === 'invasionDefended' ? 'defended' : 'missed', emoji, x: from.x, y: from.y });
    },
    ['invasionDefended', 'invasionMissed'],
  );

  if (!enabled && !invasion) return null;
  return (
    <div className="invasion-layer">
      {invasion ? <ActiveThreat key={invasion.uid} invasion={invasion} /> : null}
      {ghost ? (
        <span className="invasion-ghost" data-kind={ghost.kind} key={ghost.key} style={position(ghost.x, ghost.y)} aria-hidden="true">
          {ghost.emoji}
        </span>
      ) : null}
    </div>
  );
}
