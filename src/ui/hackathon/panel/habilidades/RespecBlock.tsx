import { useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { HK } from '../lib/hk';
import { whole } from '../lib/labels';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';

/** Take every point back for Commits and spend them again. Asks first, since it also costs the active skills. */
export function RespecBlock({ profile }: { profile: HackathonProfile }) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const [asking, setAsking] = useState(false);
  const price = HK.config.respecCommits;
  const spent = profile.level - 1 - profile.freeSkillPoints;
  const reason = spent <= 0 ? 'Nenhum ponto gasto' : profile.commits < price ? `Faltam ${whole(price - profile.commits)} Commits` : null;

  const confirm = async () => {
    setAsking(false);
    await report(useHackathon.getState().respec(), 'Pontos devolvidos. Distribua de novo.');
  };

  return (
    <div className="hk-card hk-respec">
      <div>
        <h3>Redistribuir pontos</h3>
        <p className="hk-note">Devolve os {Math.max(0, spent)} pontos gastos. As habilidades ativas escolhidas saem dos espaços.</p>
      </div>
      <div className="hk-button-note">
        <Button
          size="sm"
          variant="secondary"
          disabled={locked}
          aria-disabled={reason !== null}
          data-qa="hk-respec"
          onClick={() => {
            if (!reason) setAsking(true);
          }}
        >
          Redistribuir <Commits amount={price} />
        </Button>
        {reason ? <p className="hk-reason">{reason}</p> : null}
        <InlineError message={error} />
      </div>
      <ConfirmDialog
        open={asking}
        title="Redistribuir pontos"
        confirmLabel="Redistribuir"
        danger
        disabled={locked}
        confirmQa="hk-respec-confirm"
        onConfirm={() => void confirm()}
        onCancel={() => setAsking(false)}
      >
        <p>
          Todos os {spent} pontos voltam para você e a árvore zera. Custa <strong>{whole(price)} Commits</strong>.
        </p>
      </ConfirmDialog>
    </div>
  );
}
