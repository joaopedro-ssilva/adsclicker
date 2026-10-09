'use client';
import { formatNumber } from '@/game/engine/format';
import { useHorasView, useReleasesView } from '@/game/store';
import type { ProfessorId } from '@/game/content/types';
import { Button, ProgressBar } from '@/ui/kit';
import { useBolsaPanel } from '../../../stage/maestria/bolsa/bolsaPanelStore';

function HorasLive() {
  const view = useHorasView();
  if (!view) return null;
  return (
    <div className="maestria-live" data-qa="horas-live">
      <ProgressBar
        label="Horas desta turma"
        value={view.hours}
        max={view.capacity}
        valueLabel={`${formatNumber(view.hours, { integer: true })}/${formatNumber(view.capacity, { integer: true })} h`}
        segmented
        segments={view.bands}
        size="sm"
      />
      <p className="muted">
        {view.filled} de {view.bands} faixas: +{view.filled} {view.filled === 1 ? 'diploma' : 'diplomas'} na formatura, fora do limite.
      </p>
    </div>
  );
}

function ReleasesLive() {
  const view = useReleasesView();
  if (!view) return null;
  return (
    <p className="maestria-live" data-qa="releases-live">
      Versão da turma: <b>v{view.versions}.0</b> (+{formatNumber(view.bonus * 100)}% de produção).{' '}
      {view.maxed ? 'No máximo.' : `Faltam ${view.perVersion - view.sprints} sprints para a próxima.`}
    </p>
  );
}

/** What a Maestria shows live on its card once it is unlocked: Angelo's hours, B1's version, the way into Pablo's Bolsa. */
export function MaestriaLive({ professor }: { professor: ProfessorId }) {
  const openBolsa = useBolsaPanel((store) => store.show);
  if (professor === 'angelo') return <HorasLive />;
  if (professor === 'b1') return <ReleasesLive />;
  if (professor === 'pablo') {
    return (
      <div className="maestria-live">
        <Button size="sm" variant="secondary" onClick={openBolsa} data-qa="bolsa-open-card">
          📈 Abrir a Bolsa
        </Button>
      </div>
    );
  }
  return null;
}
