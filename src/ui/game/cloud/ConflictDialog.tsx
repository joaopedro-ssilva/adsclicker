'use client';
import { useState } from 'react';
import { moreProgress, summarizeState, useCloud } from '@/game/cloud';
import type { CloudConflict } from '@/game/cloud';
import { useGame } from '@/game/store';
import { Button, Modal } from '@/ui/kit';
import { SaveColumn } from './SaveColumn';
import { formatSavedAt } from './formatSavedAt';

const INTRO = {
  sync: 'Este aparelho e a nuvem seguiram caminhos diferentes, provavelmente porque você jogou em outro lugar. Escolha qual deles continua. O outro será substituído.',
  login:
    'Você entrou numa conta que já tem um jogo salvo, e este aparelho também tem progresso. Escolha qual deles continua. O outro será substituído.',
} as const;

const RECOMMENDATION = {
  local: 'Recomendamos este aparelho: ele tem mais progresso.',
  cloud: 'Recomendamos a nuvem: ela tem mais progresso.',
  tie: 'Os dois estão no mesmo ponto. Pode ficar com qualquer um.',
  mixed: 'Os aparelhos têm progressos diferentes. Compare o tempo de jogo e os diplomas com atenção antes de escolher.',
} as const;

function ConflictBody({ conflict }: { conflict: CloudConflict }) {
  const adoptCloud = useCloud((store) => store.useCloudSave);
  const keepLocalSave = useCloud((store) => store.keepLocalSave);
  // Frozen when the dialog opens: the game keeps running behind it, and the numbers must not move under the choice.
  const [localState] = useState(() => useGame.getState().state);
  const [local] = useState(() => summarizeState(localState));
  const [localSavedAt] = useState(() => localState.lastSavedAt);
  const [now] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<'local' | 'cloud' | null>(null);

  const best = moreProgress(local, conflict.cloud.summary);

  const localHasLoss =
    conflict.cloud.summary.playSeconds > local.playSeconds ||
    conflict.cloud.summary.diplomasEarned > local.diplomasEarned;

  const cloudHasLoss =
    local.playSeconds > conflict.cloud.summary.playSeconds ||
    local.diplomasEarned > conflict.cloud.summary.diplomasEarned;

  const handleKeepLocal = async () => {
    if (confirming !== 'local' && localHasLoss) {
      setConfirming('local');
      return;
    }
    setPending(true);
    await keepLocalSave();
    setPending(false);
  };

  const handleUseCloud = () => {
    if (confirming !== 'cloud' && cloudHasLoss) {
      setConfirming('cloud');
      return;
    }
    adoptCloud();
  };



  const localButtonVariant = best === 'local' ? 'primary' : 'secondary';
  const cloudButtonVariant = best === 'cloud' ? 'primary' : 'secondary';

  return (
    <div className="conflict">
      <p className="conflict-intro">{INTRO[conflict.origin]}</p>
      <div className="conflict-columns">
        <SaveColumn
          title="Este aparelho"
          summary={local}
          savedAt={formatSavedAt(localSavedAt, now)}
          recommended={best === 'local'}
          testId="conflict-local"
          note="Substitui o que está na nuvem."
          action={
            confirming === 'local' ? (
              <div className="conflict-confirm">
                <p className="conflict-confirm-msg">A nuvem tem mais diplomas ou tempo de jogo. Deseja substituir mesmo assim?</p>
                <div className="conflict-confirm-actions">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    data-qa="conflict-confirm-keep-local"
                    onClick={handleKeepLocal}
                  >
                    Sim, substituir
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirming(null)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant={localButtonVariant}
                disabled={pending}
                data-qa="conflict-keep-local"
                onClick={handleKeepLocal}
              >
                Manter este aparelho
              </Button>
            )
          }
        />
        <SaveColumn
          title="Nuvem"
          summary={conflict.cloud.summary}
          savedAt={formatSavedAt(conflict.cloud.savedAt, now)}
          recommended={best === 'cloud'}
          testId="conflict-cloud"
          note="Substitui o progresso deste aparelho."
          action={
            confirming === 'cloud' ? (
              <div className="conflict-confirm">
                <p className="conflict-confirm-msg">Este aparelho tem mais diplomas ou tempo de jogo. Deseja substituir mesmo assim?</p>
                <div className="conflict-confirm-actions">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    data-qa="conflict-confirm-use-cloud"
                    onClick={handleUseCloud}
                  >
                    Sim, usar nuvem
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirming(null)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant={cloudButtonVariant}
                disabled={pending}
                data-qa="conflict-use-cloud"
                onClick={handleUseCloud}
              >
                Usar a nuvem
              </Button>
            )
          }
        />

      </div>
      <p className="conflict-advice" data-dominance={best}>{RECOMMENDATION[best]}</p>
    </div>
  );
}


/** Blocks the game until the player picks which progress to keep. It cannot be closed by accident. */
export function ConflictDialog() {
  const conflict = useCloud((store) => store.conflict);
  return (
    <Modal
      open={conflict !== null}
      onClose={() => undefined}
      dismissible={false}
      size="lg"
      title={conflict?.origin === 'login' ? 'Qual progresso manter?' : 'Dois progressos diferentes'}
    >
      {conflict ? <ConflictBody conflict={conflict} /> : null}
    </Modal>
  );
}
