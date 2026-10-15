import { content, useGame } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Button, Icon, Modal } from '@/ui/kit';
import { fmtInt } from '../lib/numbers';
import { useHonourPick } from './honourPick';
import { useSections } from './sectionsStore';

interface GraduateDialogProps {
  open: boolean;
  diplomas: number;
  onClose: () => void;
}

/** The confirmation step. The graduation scene itself is played by the game shell when the `graduate` event arrives. */
export function GraduateDialog({ open, diplomas, onClose }: GraduateDialogProps) {
  const graduate = useGame((store) => store.graduate);
  const hired = useGame((store) => store.state.hired);
  const picked = useHonourPick((store) => store.pick);
  const setPick = useHonourPick((store) => store.setPick);
  const honour = picked && hired[picked] ? picked : null;
  // Every hired professor can be honoured, so the warning shows whenever someone is hired and nobody is picked.
  const canHonour = PROFESSOR_IDS.some((id) => hired[id]);
  const openSection = useSections((store) => store.setOpen);

  /** Closes the dialog, opens the picker's section and brings it into view. */
  const chooseHonour = () => {
    onClose();
    openSection('honour', true);
    window.setTimeout(() => {
      document.querySelector('[data-qa="honour-picker"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

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
              graduate(honour);
              setPick(null);
            }}
          >
            <Icon name="diploma" size={12} />
            {canHonour && !honour ? 'Formar sem homenagear' : 'Formar'} e ganhar {fmtInt(diplomas)}{' '}
            {diplomas === 1 ? 'diploma' : 'diplomas'}
          </Button>
        </>
      }
    >
      <div className="graduate-dialog">
        <p>
          Você recomeça uma turma nova com <strong>{fmtInt(diplomas)}</strong> {diplomas === 1 ? 'diploma' : 'diplomas'} no bolso. ADScoins,
          aulas, pesquisas e professores voltam ao começo. Conquistas, skins, cenários, temas e a árvore ficam com você.
        </p>
        {honour ? (
          <p className="graduate-honour" data-qa="graduate-honour">
            Homenageado: <strong>{content.professors[honour].name}</strong>, {content.mastery[honour].honour.name.toLowerCase()} (vale
            na próxima turma).
          </p>
        ) : canHonour ? (
          <div className="graduate-warning" role="alert" data-qa="graduate-no-honour">
            <p>
              Você não escolheu um professor homenageado. A homenagem deixa a mecânica de um professor mais forte na próxima turma.
            </p>
            <Button variant="secondary" size="sm" onClick={chooseHonour} data-qa="graduate-choose-honour">
              Escolher homenageado
            </Button>
          </div>
        ) : null}
        <p className="muted">Cada diploma ganho vale um bônus permanente de produção.</p>
      </div>
    </Modal>
  );
}
