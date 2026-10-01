'use client';
import { useRef, useState, type MouseEvent } from 'react';
import { content } from '@/game/content';
import type { ProfessorDef } from '@/game/content/types';
import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { Badge, Icon, NumberTicker, Panel, ProgressBar } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { defaultSkin } from '../data';

const COMBO_LENGTH = 20;
const CRIT_EVERY = 5;
const FALLBACK_PALETTE = { primary: '#d83a40', secondary: '#3a4458', accent: '#e8cfab' };

/** A miniature of the game stage built only from kit pieces: scenery, professor, balance, combo. */
export function StagePreview({ professor }: { professor: ProfessorDef }) {
  const [clicks, setClicks] = useState(0);
  const [coins, setCoins] = useState(12500);
  const balance = useRef<HTMLDivElement>(null);
  const scenery = content.sceneries.find((entry) => entry.default) ?? content.sceneries[0];
  const skin = defaultSkin(professor.id);
  const compact = useMediaQuery('(max-width: 640px)');
  const quote = professor.quotes.click[clicks % professor.quotes.click.length] ?? '';

  const click = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // detail is 0 for keyboard activation: aim at the head instead of the pointer
    const point =
      event.detail === 0
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.25 }
        : { x: event.clientX, y: event.clientY };
    const crit = (clicks + 1) % CRIT_EVERY === 0;
    const gain = crit ? 875 : 125;
    setClicks((value) => value + 1);
    fx.floatingNumber({ ...point, text: `+${gain}`, crit, thumbsUp: crit });
    if (balance.current) {
      fx.coins({
        ...point,
        target: balance.current,
        count: crit ? 22 : 6,
        onArrive: () => setCoins((value) => value + gain),
      });
    }
    if (crit) fx.shake({ intensity: 7 });
    audio.play(crit ? 'crit' : 'click');
  };

  return (
    <Panel className="stage-panel">
      <div className="panel-bar">
        <span>
          <span className="status-pixel" />
          Em sala · prévia interativa
        </span>
        <Badge tone="accent">Semestre 01</Badge>
      </div>

      {scenery ? (
        <Scenery scenery={scenery} className="stage">
          <div className="stage-hud">
            <div className="coin-readout" ref={balance}>
              <p className="eyebrow">Edécoins</p>
              <div>
                <Icon name="coin" className="coin-icon" />
                <NumberTicker value={coins.toLocaleString('pt-BR')} numericHint={coins} />
              </div>
            </div>
            <Badge className="stage-notice">A cada 5 cliques, um crítico</Badge>
          </div>
          <button
            type="button"
            className="professor-click"
            data-qa="clicker"
            onClick={click}
            aria-label={`Clicar em ${professor.name}`}
          >
            <Character
              body={skin?.body}
              head={`heads/${professor.id}`}
              palette={skin?.palette ?? FALLBACK_PALETTE}
              seed={professor.id}
              scale={compact ? 2 : 3}
              bump={clicks}
              label={professor.name}
            />
          </button>
        </Scenery>
      ) : null}

      <div className="stage-footer">
        <div className="stage-professor">
          <span className="stage-professor-icon">
            <Icon name="book" />
          </span>
          <div>
            <strong>{professor.name}</strong>
            <p>{professor.subject}</p>
          </div>
        </div>
        <ProgressBar
          value={clicks % COMBO_LENGTH}
          max={COMBO_LENGTH}
          label="Combo de demonstração"
          valueLabel={`${clicks % COMBO_LENGTH}/${COMBO_LENGTH}`}
          segmented
        />
      </div>
      <p className="stage-quote">“{quote}”</p>
    </Panel>
  );
}
