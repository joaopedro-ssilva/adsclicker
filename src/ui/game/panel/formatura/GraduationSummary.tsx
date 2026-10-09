import { useState } from 'react';
import { content, useGame, useGraduationPreview } from '@/game/store';
import { formatPercent } from '@/game/engine/format';
import { diplomaBonus } from '@/game/engine/views';
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

  // The engine's number, not earned x bonusPerDiploma: the bonus stops at balance.graduation.maxBonus.
  const bonus = useGame((store) => diplomaBonus(store.state, content));
  const { maxBonus } = content.balance.graduation;
  const bonusMaxed = maxBonus !== undefined && bonus >= maxBonus;
  const growth = content.balance.graduation.cap?.growth ?? 1;

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
            <dd title={bonusMaxed ? 'O bônus dos diplomas chegou ao teto.' : undefined}>
              +{formatPercent(bonus)}
              {bonusMaxed ? <small> máx.</small> : null}
            </dd>
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
        {preview.cap !== null ? (
          <p className="graduation-cap" data-full={preview.atCap} data-qa="diploma-cap">
            <strong>
              {fmtInt(preview.diplomas)}/{fmtInt(preview.cap)}
            </strong>{' '}
            diplomas desta turma
          </p>
        ) : null}
        {preview.atCap && preview.cap !== null ? (
          <p className="graduation-cap-note" data-qa="diploma-cap-note">
            Limite da turma atingido: as ADScoins a mais não rendem diploma. Forme a turma para subir o limite da próxima para {fmtInt(preview.cap * growth)}.
          </p>
        ) : (
          <ProgressBar
            value={preview.progress}
            max={1}
            label={`Rumo ao diploma ${preview.diplomas + 1}`}
            valueLabel={`${runCoins} / ${fmt(preview.nextAt)}`}
            segmented
            segments={24}
          />
        )}
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
