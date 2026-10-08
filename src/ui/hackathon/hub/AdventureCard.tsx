import type { HackathonProfile } from '@/shared/hackathonApi';
import { Button, Icon } from '@/ui/kit';
import { Card } from '../screen/Card';
import { useHackathonUi } from '../screen/uiStore';
import { AutoToggle } from '../panel/fases/AutoToggle';
import { frontierStage, stageLock, stageState } from '../panel/fases/stageAccess';
import { useDailyStatus } from '../panel/fases/useDailyStatus';
import { useStartStage } from '../panel/fases/useStartStage';
import { Commits } from '../panel/lib/Commits';
import { CAMPAIGN } from '../panel/lib/hk';
import { whole } from '../panel/lib/labels';
import { InlineError } from '../panel/lib/useAction';

/** Where the student is in chapter 1, the next stage with a start button, and the daily Hackathon in one line. */
export function AdventureCard({ profile }: { profile: HackathonProfile }) {
  const setTab = useHackathonUi((store) => store.setTab);
  const daily = useDailyStatus(profile);
  const stage = frontierStage(profile);
  const { reason, disabled, start, error } = useStartStage(stage.id, profile, stageLock(stage, profile));

  // Previous, current and next stop; at either end of the chapter the window slides to keep three.
  const first = Math.max(0, Math.min(CAMPAIGN.indexOf(stage) - 1, CAMPAIGN.length - 3));
  const around = CAMPAIGN.slice(first, first + 3);

  return (
    <Card title="Aventura" icon="rocket" qa="hk-adventure" className="hk-adventure">
      <ol className="hk-trail" aria-label="Sua posição no capítulo 1">
        {around.map((entry) => {
          const state = stageState(entry, profile);
          return (
            <li
              key={entry.id}
              data-state={state}
              data-current={entry.id === stage.id}
              aria-current={entry.id === stage.id ? 'step' : undefined}
            >
              <span className="hk-trail-num">
                {state === 'locked' ? <Icon name="lock" size={12} /> : state === 'cleared' ? <Icon name="check" size={12} /> : entry.order}
              </span>
              <span className="hk-trail-name">{entry.name}</span>
            </li>
          );
        })}
      </ol>

      <div className="hk-next-stage">
        <p className="hk-next-name">
          <span>Fase {stage.order}</span> {stage.name}
        </p>
        <p className="hk-next-meta">
          Pede nível {stage.requiredLevel} · {whole(stage.xp)} XP · <Commits amount={stage.commits} />
        </p>
      </div>

      <p className="hk-daily-line" data-won={daily.won}>
        Hackathon diário: <strong>{daily.won ? `vencido hoje (${daily.clears}×)` : 'não vencido hoje'}</strong>
      </p>

      <div className="hk-adventure-actions">
        <AutoToggle qa="hk-auto-hub" compact />
        <Button size="sm" variant="secondary" onClick={() => setTab('fases')}>
          Ver fases
        </Button>
        <Button size="md" variant={disabled ? 'secondary' : 'primary'} aria-disabled={disabled} data-qa="hk-start-hub" onClick={start}>
          Iniciar fase {stage.order}
          <span className="hk-price" title="Custo em Café">
            ☕ 1
          </span>
        </Button>
      </div>
      {reason ? <p className="hk-reason">{reason}</p> : null}
      <InlineError message={error} />
    </Card>
  );
}
