import { useState } from 'react';
import { content, useGame, useMaestriasView } from '@/game/store';
import type { ProfessorId } from '@/game/content/types';
import { Button, Icon, Modal } from '@/ui/kit';
import { Section } from '../../lib/Section';
import { MaestriaCard } from './MaestriaCard';

/**
 * The eight Maestrias, from the first graduation on. Each graduation gives one slot; the player decides which
 * professor gets it, so the choice goes through a confirmation. The ones not built yet are listed but not selectable.
 */
export function MaestriasSection() {
  const view = useMaestriasView();
  const unlock = useGame((store) => store.unlockMaestria);
  const [choice, setChoice] = useState<ProfessorId | null>(null);

  if (!view.visible) return null;
  const { free, used } = view.slots;
  const chosen = choice ? content.professors[choice] : null;
  const maestria = choice ? content.maestrias.defs[choice] : null;

  return (
    <Section title="Maestrias" note={free > 0 ? `${free} ${free === 1 ? 'vaga livre' : 'vagas livres'}` : `${used} em uso`}>
      <div className="maestrias" data-qa="maestrias">
        <p className="maestrias-intro">
          Cada formatura dá uma vaga. Escolha o professor que ganha a Maestria dele: um poder próprio, que fica para sempre
          e melhora com diplomas.
        </p>
        <div className="maestrias-list">
          {view.cards.map((card) => (
            <MaestriaCard key={card.professor} card={card} slotFree={free > 0} onPickSlot={setChoice} />
          ))}
        </div>
      </div>

      <Modal
        open={choice !== null}
        onClose={() => setChoice(null)}
        title="Dar a vaga a quem?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChoice(null)} data-qa="maestria-cancel">
              Ainda não
            </Button>
            <Button
              data-qa="maestria-confirm"
              onClick={() => {
                if (choice) unlock(choice);
                setChoice(null);
              }}
            >
              <Icon name="diploma" size={12} />
              Dar a vaga
            </Button>
          </>
        }
      >
        {chosen && maestria ? (
          <div className="maestria-confirm">
            <p>
              A vaga vai para <strong>{chosen.name}</strong>: <strong>{maestria.name}</strong>. Não dá para trocar depois.
            </p>
            <p className="muted">{maestria.summary}</p>
          </div>
        ) : null}
      </Modal>
    </Section>
  );
}
