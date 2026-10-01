'use client';
import { useRef, useState, type MouseEvent } from 'react';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { Button, Icon, NumberTicker, Panel, type IconName } from '@/ui/kit';
import { SectionHeading } from '../parts/SectionHeading';

type EffectKind = 'number' | 'crit' | 'coins' | 'sparkles' | 'confetti' | 'shake' | 'all';

const EFFECTS: { kind: EffectKind; icon: IconName; label: string; hint: string }[] = [
  { kind: 'number', icon: 'plus', label: 'Ganho flutuante', hint: '+12,5 K' },
  { kind: 'crit', icon: 'click', label: 'Crítico', hint: 'Maior, dourado e tremendo' },
  { kind: 'coins', icon: 'coin', label: 'Moedas voando', hint: 'Até o contador' },
  { kind: 'sparkles', icon: 'star', label: 'Brilhos', hint: 'Explosão de faíscas' },
  { kind: 'confetti', icon: 'trophy', label: 'Confetes', hint: 'Para as conquistas' },
  { kind: 'shake', icon: 'rocket', label: 'Tremor de tela', hint: 'Impacto no painel' },
];

export function FxSection() {
  const [coins, setCoins] = useState(0);
  const balance = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const fire = (kind: EffectKind, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.3 };
    const flyCoins = (count: number) => {
      if (balance.current) fx.coins({ ...point, target: balance.current, count, onArrive: () => setCoins((value) => value + count * 25) });
    };

    if (kind === 'number') fx.floatingNumber({ ...point, text: '+12,5 K' });
    else if (kind === 'crit') fx.floatingNumber({ ...point, text: '+87,5 K', crit: true, thumbsUp: true });
    else if (kind === 'coins') flyCoins(24);
    else if (kind === 'sparkles') fx.sparkles({ ...point, count: 70 });
    else if (kind === 'confetti') fx.confetti({ ...point, count: 140 });
    else if (kind === 'shake') fx.shake({ target: panel.current ?? undefined, intensity: 8 });
    else {
      fx.floatingNumber({ ...point, text: '+1,2 M', crit: true, thumbsUp: true });
      fx.sparkles({ ...point, count: 50 });
      fx.confetti({ ...point, count: 120 });
      flyCoins(30);
      fx.shake({ target: panel.current ?? undefined, intensity: 10 });
    }

    if (kind === 'crit' || kind === 'all') audio.play('crit');
    else if (kind === 'confetti') audio.play('achievement');
    else if (kind === 'coins') audio.play('buy');
    else audio.play('click');
  };

  return (
    <section className="kit-section" aria-labelledby="efeitos">
      <SectionHeading id="efeitos" number="06" title="Um clique, um espetáculo" note="Uma tela de canvas, centenas de partículas, nenhum travamento." />
      <Panel className="fx-panel" ref={panel}>
        <div className="fx-balance" ref={balance}>
          <Icon name="coin" className="coin-icon" />
          <div>
            <p className="eyebrow">Alvo das moedas</p>
            <NumberTicker value={coins.toLocaleString('pt-BR')} numericHint={coins} className="fx-balance-number" />
          </div>
        </div>
        <div className="fx-grid">
          {EFFECTS.map((effect) => (
            <Button key={effect.kind} variant="secondary" className="fx-button" onClick={(event) => fire(effect.kind, event)}>
              <Icon name={effect.icon} size={36} />
              <strong>{effect.label}</strong>
              <span>{effect.hint}</span>
            </Button>
          ))}
          <Button className="fx-button fx-button-all" onClick={(event) => fire('all', event)}>
            <Icon name="star" size={36} />
            <strong>Tudo junto</strong>
            <span>Como numa formatura</span>
          </Button>
        </div>
      </Panel>
    </section>
  );
}
