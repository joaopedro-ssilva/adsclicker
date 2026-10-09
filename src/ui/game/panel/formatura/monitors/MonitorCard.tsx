import { content, useGame } from '@/game/store';
import type { MonitorView, MonitorsView } from '@/game/store';
import type { MonitorId } from '@/game/content/types';
import { MONITOR_SHARES, SPRINT_PICKS } from '@/game/engine/state';
import type { SprintPick } from '@/game/engine/state';
import { Button, Icon } from '@/ui/kit';
import { useReducedMotion } from '@/ui/ThemeProvider';
import { playLimited, shake } from '../../lib/feedback';

/** Name of the last thing a monitor dealt with, looked up in the content list that matches the monitor. */
const lastNames: Record<MonitorId, Map<string, string>> = {
  compras: new Map(content.disciplines.map((def) => [def.id, def.name])),
  pesquisa: new Map(content.research.map((def) => [def.id, def.name])),
  seguranca: new Map(content.invasions.map((def) => [def.id, def.name])),
  sprints: new Map(content.sprints.map((def) => [def.id, def.name])),
};

const DONE_WORDS: Record<MonitorId, [string, string]> = {
  compras: ['compra', 'compras'],
  pesquisa: ['pesquisa', 'pesquisas'],
  seguranca: ['defesa', 'defesas'],
  sprints: ['sprint aceita', 'sprints aceitas'],
};

const PICK_LABELS: Record<SprintPick, string> = {
  first: 'A primeira',
  best: 'A que mais paga',
  clicks: 'Só de clique',
};

const SHARE_LABEL = (share: number) => `${Math.round(share * 100)}%`;

interface MonitorCardProps {
  view: MonitorView;
  settings: MonitorsView['settings'];
}

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="monitor-pips" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} data-on={i < level} />
      ))}
    </span>
  );
}

/** The one setting a monitor has, if it has one. */
function Setting({ view, settings }: MonitorCardProps) {
  const update = useGame((store) => store.setMonitorSettings);

  if (view.id === 'compras' || view.id === 'pesquisa') {
    const key = view.id === 'compras' ? 'comprasShare' : 'pesquisaShare';
    const value = settings[key];
    return (
      <div className="monitor-setting">
        <span id={`monitor-${view.id}-setting`}>Gasta até, de cada vez</span>
        <div className="monitor-choices" role="radiogroup" aria-labelledby={`monitor-${view.id}-setting`}>
          {MONITOR_SHARES.map((share) => (
            <button
              key={share}
              type="button"
              role="radio"
              aria-checked={value === share}
              data-qa={`monitor-${view.id}-share-${Math.round(share * 100)}`}
              onClick={() => update({ [key]: share })}
            >
              {SHARE_LABEL(share)}
            </button>
          ))}
        </div>
        <p className="monitor-hint">das ADScoins que você tem. Menos é mais reserva para o que você está juntando.</p>
      </div>
    );
  }

  if (view.id === 'sprints') {
    return (
      <div className="monitor-setting">
        <span id="monitor-sprints-setting">Escolhe</span>
        <div className="monitor-choices" role="radiogroup" aria-labelledby="monitor-sprints-setting">
          {SPRINT_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              role="radio"
              aria-checked={settings.sprintPick === pick}
              data-qa={`monitor-sprints-pick-${pick}`}
              onClick={() => update({ sprintPick: pick })}
            >
              {PICK_LABELS[pick]}
            </button>
          ))}
        </div>
        {settings.sprintPick === 'clicks' ? (
          <p className="monitor-hint">Pula metas de compra e de defesa; sem meta de clique, deixa a escolha com você.</p>
        ) : null}
      </div>
    );
  }
  return null;
}

/** One Monitor: what it does now, its level, the switch, its setting and the way to hire or raise it. */
export function MonitorCard({ view, settings }: MonitorCardProps) {
  const buy = useGame((store) => store.buyMonitor);
  const toggle = useGame((store) => store.setMonitorOn);
  const reduced = useReducedMotion();
  const hired = view.level > 0;
  const maxed = view.cost === null;
  const lastName = view.last ? lastNames[view.id].get(view.last) : undefined;
  const words = DONE_WORDS[view.id];

  const onBuy = (element: HTMLElement) => {
    if (!buy(view.id)) {
      playLimited('cantAfford', 120);
      shake(element, reduced);
    }
  };

  return (
    <article className="monitor" data-hired={hired} data-on={hired && view.on} data-qa={`monitor-${view.id}`}>
      <header className="monitor-head">
        <span className="monitor-emoji" aria-hidden="true">
          {view.emoji}
        </span>
        <div className="monitor-title">
          <h3>{view.name}</h3>
          <p className="monitor-level">
            <Pips level={view.level} max={view.maxLevel} />
            {hired ? `Nível ${view.level}/${view.maxLevel}` : 'Não contratado'}
          </p>
        </div>
        {hired ? (
          <button
            type="button"
            role="switch"
            aria-checked={view.on}
            aria-label={`${view.name}: ${view.on ? 'ligado' : 'desligado'}`}
            className="monitor-switch"
            data-qa={`monitor-${view.id}-switch`}
            onClick={() => toggle(view.id, !view.on)}
          >
            <span className="monitor-switch-knob" aria-hidden="true" />
            <span>{view.on ? 'Ligado' : 'Desligado'}</span>
          </button>
        ) : null}
      </header>

      <p className="monitor-desc">{view.description}</p>

      {hired ? (
        <>
          <p className="monitor-now" data-qa={`monitor-${view.id}-now`}>
            <strong>Agora:</strong> {view.line}
          </p>
          {view.idle ? <p className="monitor-idle">{view.idle}</p> : null}
          <Setting view={view} settings={settings} />
          <p className="monitor-tally">
            {view.done} {view.done === 1 ? words[0] : words[1]}
            {lastName ? ` · última: ${lastName}` : ''}
          </p>
        </>
      ) : (
        <p className="monitor-now">{view.line}</p>
      )}

      <footer className="monitor-buy">
        {maxed ? (
          <p className="monitor-maxed">
            <Icon name="check" size={12} /> Nível máximo
          </p>
        ) : (
          <>
            {hired && view.nextLine ? (
              <p className="monitor-next">
                <strong>Nível {view.level + 1}:</strong> {view.nextLine}
              </p>
            ) : null}
            <Button
              size="sm"
              variant={view.affordable ? 'primary' : 'secondary'}
              aria-disabled={!view.affordable}
              data-qa={`monitor-${view.id}-buy`}
              onClick={(event) => onBuy(event.currentTarget)}
            >
              {hired ? 'Melhorar' : 'Contratar'}
              <span className="monitor-cost">
                <Icon name="diploma" size={12} />
                {view.cost}
              </span>
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}
