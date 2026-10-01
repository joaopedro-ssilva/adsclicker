'use client';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import { Badge, Panel } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { MultiplierPicker } from './MultiplierPicker';
import { useApiAction } from './useApiAction';

interface EventCardProps {
  /** Null until the first list arrives. */
  multiplier: number | null;
  onChanged: () => void;
}

const PRESETS = [1, 2, 5, 10] as const;

export function EventCard({ multiplier, onChanged }: EventCardProps) {
  const { busy, message, run } = useApiAction();

  const apply = async (value: number) => {
    const done = await run(
      () => api.admin.setEvent({ multiplier: value }),
      value === 1 ? 'Evento encerrado.' : `Evento ×${formatNumber(value)} ativo.`,
    );
    if (done) onChanged();
  };

  return (
    <Panel className="admin-card">
      <div className="admin-card-head">
        <h2>Evento global</h2>
        {multiplier !== null ? (
          <Badge tone={multiplier === 1 ? 'neutral' : 'warn'} data-qa="admin-event-current">
            {multiplier === 1 ? 'Sem evento' : `Ativo: ×${formatNumber(multiplier)}`}
          </Badge>
        ) : null}
      </div>
      <p className="muted">
        Multiplica as ADScoins de todos os jogadores, sem tirar ninguém do ranking. Vale para todo mundo em cerca de 1 minuto,
        quando o jogo de cada um sincroniza.
      </p>
      <MultiplierPicker
        name="admin-event"
        presets={PRESETS}
        current={multiplier ?? 1}
        busy={busy || multiplier === null}
        onApply={apply}
        custom
      />
      <ActionResultText message={message} />
    </Panel>
  );
}
