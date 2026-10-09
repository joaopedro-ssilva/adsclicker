'use client';
import { useCloud } from '@/game/cloud';
import { Button, Modal } from '@/ui/kit';

/**
 * Shown once, to a player who comes back after the launch reset with a save from the test phase:
 * the game started over so the official ranking begins even for everybody. Their old save stays
 * on this device (it is never sent to the server).
 */
export function LaunchResetDialog() {
  const notice = useCloud((store) => store.launchReset);
  const dismiss = useCloud((store) => store.dismissLaunchReset);
  return (
    <Modal open={notice !== null} onClose={dismiss} title="O jogo foi zerado para o lançamento">
      <div className="conflict" data-qa="launch-reset-notice">
        <p className="conflict-intro">
          Obrigado por jogar na fase de testes! Para o ranking oficial começar do zero para todo mundo, o progresso foi reiniciado.
          Seu apelido, sua senha e seus títulos continuam com você.
        </p>
        <p className="conflict-advice">O jogo de antes ficou guardado apenas neste aparelho; ele não volta ao ranking.</p>
        <Button variant="primary" data-qa="launch-reset-ok" onClick={dismiss}>
          Começar
        </Button>
      </div>
    </Modal>
  );
}
