import { useState } from 'react';
import { content, useGame, useGraduationPreview } from '@/game/store';
import { formatPercent } from '@/game/engine/format';
import { Button, Icon, ProgressBar } from '@/ui/kit';
import { fmt, fmtInt } from '../lib/numbers';
import { GraduateDialog } from './GraduateDialog';

/** Diplomas in hand, what a graduation would give right now, and the way to do it. */
export function GraduationSummary() {
  const preview = useGraduationPreview();
  const diplomas = useGame((store) => store.state.diplomas);
  const earned = useGame((store) => store.state.diplomasEarned);
  const graduations = useGame((store) => store.state.counters.graduations);
  const runCoins = useGame((store) => fmt(store.state.runCoins));
  const [confirming, setConfirming] = useState(false);

  const bonus = earned * content.balance.graduation.bonusPerDiploma;

  return (
    <div className="graduation-summary">
      <div className="graduation-wallet">
        <div>
          <p className="eyebrow">Diplomas para gastar</p>
          <p className="graduation-diplomas" data-qa="diplomas">
            <Icon name="diploma" size={24} />
            <strong>{fmtInt(diplomas)}</strong>
          </p>
        </div>
        <dl className="graduation-facts">
          <div>
            <dt>Ganhos no total</dt>
            <dd>{fmtInt(earned)}</dd>
          </div>
          <div>
            <dt>Bônus de produção</dt>
            <dd>+{formatPercent(bonus)}</dd>
          </div>
          <div>
            <dt>Formaturas</dt>
            <dd>{graduations}</dd>
          </div>
        </dl>
      </div>

      <div className="graduation-preview" data-ready={preview.canGraduate}>
        <p className="eyebrow">Se você se formar agora</p>
        <p className="graduation-gain">
          <strong>+{fmtInt(preview.diplomas)}</strong>
          <span>{preview.diplomas === 1 ? 'diploma' : 'diplomas'}</span>
        </p>
        <ProgressBar
          value={preview.progress}
          max={1}
          label={`Rumo ao diploma ${preview.diplomas + 1}`}
          valueLabel={`${runCoins} / ${fmt(preview.nextAt)}`}
          segmented
          segments={24}
        />
        {preview.unlocked ? (
          <Button
            size="lg"
            className="graduation-button"
            data-qa="graduate"
            disabled={!preview.canGraduate}
            onClick={() => setConfirming(true)}
          >
            <Icon name="diploma" size={24} />
            {preview.canGraduate ? 'Formar a turma' : 'Ainda sem diploma para ganhar'}
          </Button>
        ) : (
          <p className="graduation-locked">
            <Icon name="lock" size={12} /> Contrate o Angelo para se formar de novo.
          </p>
        )}
      </div>

      <GraduateDialog open={confirming} diplomas={preview.diplomas} onClose={() => setConfirming(false)} />
    </div>
  );
}
