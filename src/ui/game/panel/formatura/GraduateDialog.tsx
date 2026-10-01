import { useGame } from '@/game/store';
import { Button, Icon, Modal } from '@/ui/kit';
import { fmtInt } from '../lib/numbers';

interface GraduateDialogProps {
  open: boolean;
  diplomas: number;
  onClose: () => void;
}

/** The confirmation step. The graduation scene itself is played by the game shell when the `graduate` event arrives. */
export function GraduateDialog({ open, diplomas, onClose }: GraduateDialogProps) {
  const graduate = useGame((store) => store.graduate);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Formar a turma?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-qa="graduate-cancel">
            Ainda não
          </Button>
          <Button
            data-qa="graduate-confirm"
            onClick={() => {
              onClose();
              graduate();
            }}
          >
            <Icon name="diploma" size={12} />
            Formar e ganhar {fmtInt(diplomas)} {diplomas === 1 ? 'diploma' : 'diplomas'}
          </Button>
        </>
      }
    >
      <div className="graduate-dialog">
        <p>
          Você recomeça uma turma nova com <strong>{fmtInt(diplomas)}</strong> {diplomas === 1 ? 'diploma' : 'diplomas'} no bolso. Edécoins,
          aulas, pesquisas e professores voltam ao começo. Conquistas, skins, cenários, temas e a árvore ficam com você.
        </p>
        <p className="muted">Cada diploma ganho vale um bônus permanente de produção.</p>
      </div>
    </Modal>
  );
}
