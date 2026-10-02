'use client';
import { audio } from '@/ui/audio';
import { useHackathon } from '../store';
import { useHackathonUnlocked } from './useHackathonUnlocked';

/** Classroom to Hackathon and back. Hidden until the third professor was hired; locked while a fight is on. */
export function ModeSwitch() {
  const unlocked = useHackathonUnlocked();
  const mode = useHackathon((store) => store.mode);
  const fighting = useHackathon((store) => store.run !== null);
  const setMode = useHackathon((store) => store.setMode);

  if (!unlocked && mode === 'classroom') return null;
  const toHackathon = mode === 'classroom';

  return (
    <button
      type="button"
      className="ar-mode"
      data-target={toHackathon ? 'hackathon' : 'classroom'}
      data-qa="mode-switch"
      disabled={fighting}
      title={fighting ? 'Termine a luta para voltar à sala de aula' : undefined}
      onClick={() => {
        audio.play('uiTap');
        setMode(toHackathon ? 'hackathon' : 'classroom');
      }}
    >
      <span className="ar-mode-icon" aria-hidden="true">
        {toHackathon ? '⚔️' : '🏫'}
      </span>
      <span className="ar-mode-text">
        <small>{toHackathon ? 'Modo' : 'Voltar para'}</small>
        <b>{toHackathon ? 'Hackathon' : 'Sala de aula'}</b>
      </span>
    </button>
  );
}
