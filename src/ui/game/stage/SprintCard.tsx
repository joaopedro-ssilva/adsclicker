'use client';
import { useState } from 'react';
import { useGame, useGameState, useHasFeature } from '@/game/store';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { Button, Icon, ProgressBar } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { sprintById } from '../wiring/describe';
import { LayerReveal } from './LayerReveal';
import { goalText, rewardLabel } from './sprintText';

function ActiveSprintView() {
  const sprint = useGameState((state) => state.sprint.active);
  const now = useGameState((state) => state.lastTickAt);
  const def = sprint ? sprintById.get(sprint.def) : undefined;
  if (!sprint || !def) return null;

  const seconds = def.goal.kind === 'earnSeconds';
  const done = Math.min(sprint.progress, sprint.target);
  const valueLabel = seconds ? `${Math.floor(done)}/${sprint.target} s` : `${formatNumber(done, { integer: true })}/${formatNumber(sprint.target, { integer: true })}`;
  const left = Math.max(0, sprint.endsAt - now);

  return (
    <div className="sprint-active">
      <div className="sprint-head">
        <span className="sprint-emoji" aria-hidden="true">
          {def.emoji}
        </span>
        <div>
          <p className="sprint-title">{def.name}</p>
          <p className="sprint-sub">{goalText(def.goal)}</p>
        </div>
        <span className="sprint-time" data-urgent={left < 10_000}>
          <Icon name="clock" size={12} />
          {formatDuration(left)}
        </span>
      </div>
      <ProgressBar value={done} max={sprint.target} ariaLabel={`Progresso da sprint ${def.name}`} valueLabel={valueLabel} segmented segments={16} size="sm" />
      <p className="sprint-reward">Prêmio: {rewardLabel(def.reward)}</p>
    </div>
  );
}

function Offers() {
  const offers = useGameState((state) => state.sprint.offers);
  const accept = useGame((store) => store.acceptSprint);
  const narrow = useMediaQuery('(max-width: 1023px)');
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? !narrow;

  return (
    <div className="sprint-offers" data-open={expanded}>
      <button type="button" className="sprint-toggle" aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
        <span className="sprint-title">Sprints: escolha uma</span>
        <span className="sprint-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <ul>
          {offers.map((id) => {
            const def = sprintById.get(id);
            if (!def) return null;
            return (
              <li key={id}>
                <span className="sprint-emoji" aria-hidden="true">
                  {def.emoji}
                </span>
                <div className="sprint-offer-text">
                  <p className="sprint-title">{def.name}</p>
                  <p className="sprint-sub">
                    {goalText(def.goal)} em {formatDuration(def.durationMs)}
                  </p>
                  <p className="sprint-sub">🎁 {rewardLabel(def.reward)}</p>
                </div>
                <Button size="sm" onClick={() => accept(id)} aria-label={`Aceitar a sprint ${def.name}`}>
                  Aceitar
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Waiting() {
  const next = useGameState((state) => state.sprint.nextOffersAt);
  const now = useGameState((state) => state.lastTickAt);
  const left = next - now;
  return (
    <p className="sprint-wait">
      <Icon name="clock" size={12} /> {left > 0 ? `Novas sprints em ${formatDuration(left)}` : 'Preparando novas sprints'}
    </p>
  );
}

/** B1's layer: three offers to choose from, the running sprint with its goal and countdown, or the wait for new offers. */
export function SprintCard() {
  const enabled = useHasFeature('sprints');
  const active = useGameState((state) => state.sprint.active !== null);
  const hasOffers = useGameState((state) => state.sprint.offers.length > 0);
  if (!enabled) return null;

  return (
    <LayerReveal layer="sprints" className="sprint-slot">
      <section className="sprint pixel-frame" aria-label="Sprint" data-qa="sprint">
        {active ? <ActiveSprintView /> : hasOffers ? <Offers /> : <Waiting />}
      </section>
    </LayerReveal>
  );
}
