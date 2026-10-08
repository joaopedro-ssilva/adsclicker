'use client';
import { useState } from 'react';
import { useCloud } from '@/game/cloud';
import { hackathonContent } from '@/hackathon/content';
import { Character } from '@/ui/art/Character';
import { useUi } from '@/ui/game/shared/uiStore';
import { Button } from '@/ui/kit';
import { Window } from '../screen/Window';
import { useHackathon } from '../store';
import { headById } from '../shared/lookup';
import { HeadOption } from './HeadOption';
import { studentSprite } from './studentSprite';
import { useFitScale } from './useFitScale';

/** First visit: pick one of the twelve heads, seen live on the student's body with the account nickname. */
export function StudentCreation() {
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const pending = useHackathon((store) => store.pending);
  const createStudent = useHackathon((store) => store.createStudent);
  const setMode = useHackathon((store) => store.setMode);
  const setTab = useUi((store) => store.setTab);
  const { ref, scale } = useFitScale(300);
  const [head, setHead] = useState(hackathonContent.heads[0]?.id ?? 'cacheado');
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    const result = await createStudent(head);
    if (!result.ok) setError(result.message);
  };

  const goToConfig = () => {
    setMode('classroom');
    setTab('config');
  };

  return (
    <div className="ar-frame" data-width="md" ref={ref}>
      <Window title="Crie seu aluno" subtitle="Escolha a cabeça: o nome é o apelido da sua conta." icon="star" size="md">
        <div className="ar-create">
          <div className="ar-create-body">
            <div className="ar-create-preview">
              <Character {...studentSprite(head, 'estudante', head)} scale={scale} label="Seu aluno" />
              <p className="ar-nameplate">{nickname ?? 'Aluno sem nome'}</p>
              <p className="ar-nameplate-sub">Estudante · nível 1</p>
            </div>
            <div className="ar-create-grid" role="group" aria-label="Escolha a cabeça do aluno">
              {hackathonContent.heads.map((option) => (
                <HeadOption key={option.id} head={option} selected={option.id === head} disabled={pending} onPick={setHead} />
              ))}
            </div>
          </div>
          <p className="ar-create-picked">{headById.get(head)?.name}</p>
          {nickname === null ? (
            <p className="ar-warning" role="alert">
              Sua conta ainda não tem apelido. O aluno usa o apelido da conta como nome.{' '}
              <button type="button" className="ar-link" onClick={goToConfig}>
                Escolher na Config da sala de aula
              </button>
            </p>
          ) : null}
          {error ? (
            <p className="ar-warning" role="alert">
              {error}
            </p>
          ) : null}
          <Button size="lg" onClick={create} disabled={pending || nickname === null}>
            {pending ? 'Criando...' : 'Criar aluno'}
          </Button>
        </div>
      </Window>
    </div>
  );
}
