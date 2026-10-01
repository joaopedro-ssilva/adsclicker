import { useState } from 'react';
import { useGame } from '@/game/store';
import { Button, Icon, Modal, toast } from '@/ui/kit';
import { Section } from '../lib/Section';

const PHRASE = 'RESETAR';

/** Wipes everything, behind a typed confirmation. */
export function ResetZone() {
  const hardReset = useGame((store) => store.hardReset);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toUpperCase() === PHRASE;

  const close = () => {
    setOpen(false);
    setTyped('');
  };

  return (
    <Section title="Zona de perigo">
      <div className="setting-group danger-zone">
        <p className="setting-hint">Apaga tudo: ADScoins, professores, diplomas, conquistas e coleção. Não dá para desfazer.</p>
        <Button size="sm" variant="danger" data-qa="reset-open" onClick={() => setOpen(true)}>
          <Icon name="x" size={12} />
          Apagar meu progresso
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title="Apagar tudo?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close} data-qa="reset-cancel">
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!confirmed}
              data-qa="reset-confirm"
              onClick={() => {
                hardReset();
                close();
                toast({ title: 'Progresso apagado', description: 'Uma turma nova começa agora.', tone: 'warn', emoji: '🧹' });
              }}
            >
              Apagar tudo
            </Button>
          </>
        }
      >
        <div className="reset-dialog">
          <p>
            Isso remove o save e recomeça do zero. Se quiser guardar uma cópia, exporte antes. Para confirmar, digite{' '}
            <strong>{PHRASE}</strong>.
          </p>
          <input
            className="text-input"
            type="text"
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={PHRASE}
            aria-label={`Digite ${PHRASE} para confirmar`}
            data-qa="reset-input"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      </Modal>
    </Section>
  );
}
