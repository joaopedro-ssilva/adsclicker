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
} as const;

function ConflictBody({ conflict }: { conflict: CloudConflict }) {
  const useCloudSave = useCloud((store) => store.useCloudSave);
  const keepLocalSave = useCloud((store) => store.keepLocalSave);
  // Frozen when the dialog opens: the game keeps running behind it, and the numbers must not move under the choice.
  const [local] = useState(() => summarizeState(useGame.getState().state));
  const [now] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const best = moreProgress(local, conflict.cloud.summary);

  const keepLocal = async () => {
    setPending(true);
    await keepLocalSave();
    setPending(false);
  };

  return (
    <div className="conflict">
      <p className="conflict-intro">{INTRO[conflict.origin]}</p>
      <div className="conflict-columns">
        <SaveColumn
          title="Este aparelho"
          summary={local}
          savedAt="agora"
          recommended={best === 'local'}
          testId="conflict-local"
          note="Substitui o que está na nuvem."
          action={
            <Button
              variant={best === 'cloud' ? 'secondary' : 'primary'}
              disabled={pending}
              data-qa="conflict-keep-local"
              onClick={keepLocal}
            >
              Manter este aparelho
            </Button>
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
            <Button
              variant={best === 'cloud' ? 'primary' : 'secondary'}
              disabled={pending}
              data-qa="conflict-use-cloud"
              onClick={useCloudSave}
            >
              Usar a nuvem
            </Button>
          }
        />
      </div>
      <p className="conflict-advice">{RECOMMENDATION[best]}</p>
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
