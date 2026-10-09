'use client';
import { memo } from 'react';
import { content, useGame, useGameState } from '@/game/store';
import type { ActiveSwarm, SwarmBug } from '@/game/engine/maestria';
import { ASSETS } from '@/ui/art/manifest';
import { cssVariables } from '@/ui/theme';

const { kinds, boss } = content.maestrias.swarm;
const kindById = new Map([...kinds, boss].map((kind) => [kind.id, kind]));

/** Keeps the bugs between the side columns of the stage (sprints on the left, abilities on the right). */
const position = (x: number, y: number) =>
  cssVariables({ '--x': `${(20 + x * 60).toFixed(2)}%`, '--y': `${(14 + y * 68).toFixed(2)}%` });

const Bug = memo(function Bug({ bug }: { bug: SwarmBug }) {
  const hit = useGame((store) => store.hitBug);
  const kind = kindById.get(bug.kind);
  const meta = kind ? ASSETS[kind.sprite] : undefined;
  if (!kind) return null;

  return (
    <button
      type="button"
      className="swarm-bug"
      data-boss={bug.boss}
      data-qa={bug.boss ? 'swarm-boss' : 'swarm-bug'}
      style={{ ...position(bug.x, bug.y), ...cssVariables({ '--w': String(meta?.w ?? 40), '--h': String(meta?.h ?? 40) }) }}
      aria-label={`${kind.name}: ${bug.hp} de ${bug.maxHp} de vida. Clique para atacar.`}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        hit(bug.uid);
      }}
      onClick={(event) => {
        if (event.detail === 0) hit(bug.uid);
      }}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <span className="swarm-pips" aria-hidden="true">
        {Array.from({ length: bug.maxHp }, (_, index) => (
          <i key={index} data-on={index < bug.hp} />
        ))}
      </span>
      <span
        className="swarm-sprite"
        key={bug.hp}
        aria-hidden="true"
        style={meta ? { backgroundImage: `url(/assets/${kind.sprite}.png)` } : undefined}
      >
        {meta ? null : '🐛'}
      </span>
    </button>
  );
});

function SwarmHud({ swarm, now }: { swarm: ActiveSwarm; now: number }) {
  const total = content.maestrias.swarm.bugs;
  const left = Math.max(0, swarm.endsAt - now);
  const duration = swarm.endsAt - swarm.startedAt;
  const bossBug = swarm.bugs.find((bug) => bug.boss);

  return (
    <div className="swarm-hud pixel-frame" data-qa="swarm-hud" role="status" aria-label="Super invasão em curso">
      <p className="swarm-title">
        <span aria-hidden="true">🐛</span> Super invasão
        <span className="swarm-time" data-urgent={left < 10_000}>
          {Math.ceil(left / 1000)} s
        </span>
      </p>
      <div className="swarm-timebar" aria-hidden="true">
        <i style={{ width: `${duration > 0 ? (left / duration) * 100 : 0}%` }} />
      </div>
      <p className="swarm-count">
        Bugs <b>{swarm.defeated}</b>/{total}
        {swarm.bossDefeated ? ' · chefe caiu' : ''}
      </p>
      {bossBug ? (
        <div className="swarm-bossbar" aria-label={`${boss.name}: ${bossBug.hp} de ${bossBug.maxHp}`}>
          <span>{boss.name}</span>
          <i style={{ width: `${(bossBug.hp / bossBug.maxHp) * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** The Super invasão on the stage: the bugs and the boss to click, and the timer. */
export function SwarmLayer() {
  const swarm = useGameState((state) => state.maestria.swarm.active);
  const now = useGameState((state) => state.lastTickAt);
  if (!swarm) return null;

  return (
    <div className="swarm-layer" data-qa="swarm-layer">
      <SwarmHud swarm={swarm} now={now} />
      {swarm.bugs.map((bug) => (
        <Bug key={bug.uid} bug={bug} />
      ))}
    </div>
  );
}
