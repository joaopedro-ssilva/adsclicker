'use client';
import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Button, Icon, Modal, ProgressBar } from '@/ui/kit';
import { entryCaption } from './labFormat';
import { useLabOverlay } from './labOverlayStore';
import { useLabEntry } from './useLabEntry';
import { shortcutKey } from '../stage/shortcutList';

const NAME = 'Laboratório de Pesquisa';
/** What fits where a professor's name goes. */
const SHORT_NAME = 'LABTEC';

/** The pixel flask the Laboratório wears where a professor would show a portrait. */
function LabFace({ dim = false }: { dim?: boolean }) {
  return (
    <span className="roster-face lab-face" data-dim={dim || undefined} aria-hidden="true">
      <Icon name="flask" size={36} />
    </span>
  );
}

/**
 * The Laboratório as the ninth professor of the roster along the bottom of the stage (and of the phone dock): a wide card
 * with the price while it is locked, a regular slot once it is yours.
 */
export function LabRosterSlot() {
  const entry = useLabEntry();
  if (!entry.visible) return null;

  if (!entry.unlocked) {
    const progress = Math.floor(Math.min(1, entry.diplomas / entry.cost) * 100);
    return (
      <div className="roster-slot roster-next lab-slot" data-state="next" data-lab data-affordable={entry.affordable} data-qa="roster-lab">
        <LabFace dim />
        <div className="roster-offer">
          <span className="roster-name" title={NAME}>
            {SHORT_NAME}
          </span>
          <p className="roster-cost">
            <Icon name="diploma" size={12} /> {entry.cost} diplomas
          </p>
          <ProgressBar value={progress} max={100} ariaLabel="Diplomas para desbloquear o Laboratório" size="sm" tone={entry.affordable ? 'good' : 'accent'} />
          <Button size="sm" disabled={!entry.canUnlock} onClick={entry.activate} data-qa="lab-unlock" aria-label={`Desbloquear o ${NAME} por ${entry.cost} diplomas`}>
            Desbloquear
          </Button>
        </div>
      </div>
    );
  }

  const caption = entryCaption(entry);
  return (
    <button
      type="button"
      className="roster-slot lab-slot"
      data-state="hired"
      data-lab
      data-attention={entry.attention || undefined}
      data-broken={entry.status === 'broken' || undefined}
      data-qa="roster-lab"
      title={`${NAME} (${shortcutKey('lab')})`}
      aria-label={`${NAME}. ${caption}`}
      onClick={() => {
        audio.play('uiTap');
        entry.activate();
      }}
    >
      <LabFace />
      <span className="roster-name">{SHORT_NAME}</span>
      <span className="lab-slot-caption">{caption}</span>
    </button>
  );
}

/** The same door in the Aulas tab, next to the professors. */
export function LabStripChip() {
  const entry = useLabEntry();
  if (!entry.visible) return null;
  const caption = entry.unlocked ? entryCaption(entry) : `${entry.cost} diplomas`;
  return (
    <button
      type="button"
      className="professor-chip lab-chip"
      data-attention={entry.attention || undefined}
      aria-label={`${NAME}. ${caption}`}
      title={`${NAME}: ${caption}`}
      data-qa="tree-lab"
      onClick={entry.activate}
    >
      <Icon name="flask" size={24} />
    </button>
  );
}

/** "Gastar 30 diplomas?", like the graduation confirmation. The Laboratório stays yours across graduations. */
export function LabUnlockDialog() {
  const open = useLabOverlay((store) => store.unlockAsk);
  const close = useLabOverlay((store) => store.closeUnlock);
  const unlock = useGame((store) => store.unlockLab);
  const entry = useLabEntry();

  return (
    <Modal
      open={open}
      onClose={close}
      title="Desbloquear o Laboratório?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close} data-qa="lab-unlock-cancel">
            Ainda não
          </Button>
          <Button
            disabled={!entry.canUnlock}
            data-qa="lab-unlock-confirm"
            onClick={() => {
              close();
              if (unlock()) useLabOverlay.getState().show();
            }}
          >
            <Icon name="diploma" size={12} />
            Gastar {entry.cost} diplomas
          </Button>
        </>
      }
    >
      <div className="graduate-dialog">
        <p>
          O <strong>{NAME}</strong> é um mini-jogo dentro de um monitor: você pesquisa, derrota bugs e escolhe itens que também reforçam o clicker.
          Custa <strong>{entry.cost} diplomas, uma vez só</strong>, e fica com você nas próximas turmas.
        </p>
        <p className="muted">
          Você tem {entry.diplomas} {entry.diplomas === 1 ? 'diploma' : 'diplomas'}. O bônus de produção dos diplomas ganhos continua o mesmo.
        </p>
      </div>
    </Modal>
  );
}
