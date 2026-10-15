import { useState } from 'react';
import { content, useGame } from '@/game/store';
import { canResetPrestigeTree, prestigeTreeSpent } from '@/game/engine/prestige';
import { Button, Modal } from '@/ui/kit';
import { fmtInt } from '../lib/numbers';

/** Takes the tree back and refunds its diplomas; once per turma, so it is a way to rethink a build, not to dodge costs. */
export function TreeReset() {
  const refund = useGame((store) => prestigeTreeSpent(store.state, content));
  const available = useGame((store) => canResetPrestigeTree(store.state, content));
  const used = useGame((store) => store.state.treeResetGraduation === store.state.counters.graduations);
  const reset = useGame((store) => store.resetPrestigeTree);
  const [open, setOpen] = useState(false);

  // Nothing bought and nothing used: there is nothing to offer.
  if (refund <= 0 && !used) return null;

  const unit = refund === 1 ? 'diploma' : 'diplomas';
  return (
    <div className="tree-reset" data-qa="tree-reset">
      <Button variant="secondary" size="sm" disabled={!available} onClick={() => setOpen(true)} data-qa="tree-reset-open">
        Resetar árvore
      </Button>
      {used ? <p className="tree-reset-note">Disponível de novo na próxima turma</p> : null}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Resetar a árvore?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-qa="tree-reset-cancel">
              Cancelar
            </Button>
            <Button
              variant="danger"
              data-qa="tree-reset-confirm"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Resetar e receber {fmtInt(refund)} {unit}
            </Button>
          </>
        }
      >
        <div className="graduate-dialog">
          <p>
            Todos os nós voltam a zero e <strong>{fmtInt(refund)}</strong> {unit} voltam para você gastar de novo. Monitores não entram
            nessa conta.
          </p>
          <p className="muted">Só dá para resetar a árvore uma vez por turma. Ela fica disponível de novo depois da próxima formatura.</p>
        </div>
      </Modal>
    </div>
  );
}
