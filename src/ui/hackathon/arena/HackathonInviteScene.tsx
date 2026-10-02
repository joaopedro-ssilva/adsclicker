'use client';
import { useEffect } from 'react';
import { Character } from '@/ui/art/Character';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { SceneOverlay } from '@/ui/game/moments/SceneOverlay';
import { Button } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { useHackathon } from '../store';
import { studentSprite } from './studentSprite';

interface HackathonInviteSceneProps {
  onClose: () => void;
}

const COLOR = '#6ee7ff';

/** Shown once, when the third professor arrives: the classroom has a second game mode now. */
export function HackathonInviteScene({ onClose }: HackathonInviteSceneProps) {
  const setMode = useHackathon((store) => store.setMode);
  const tall = useMediaQuery('(min-height: 760px)');

  useEffect(() => {
    audio.play('unlock');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const timers = [
      setTimeout(() => fx.confetti({ x: w * 0.5, y: h * 0.36, count: 70 }), 450),
      setTimeout(() => fx.sparkles({ x: w * 0.5, y: h * 0.45, count: 40, color: COLOR }), 700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <SceneOverlay label="O Hackathon abriu" accent={COLOR} variant="hire" onClose={onClose}>
      <div className="hire">
        <p className="scene-kicker">Novo modo de jogo</p>
        <div className="hire-stage">
          <div className="hire-actor">
            <Character {...studentSprite('cacheado', 'estudante', 'hackathon')} scale={tall ? 4 : 3} label="Um aluno do Hackathon" />
          </div>
          <div className="hire-card">
            <h3 className="scene-title">Hackathon</h3>
            <p className="hire-subject">Crie um aluno e enfrente os bugs</p>
            <blockquote className="hire-quote">
              A Bruna B2 abriu o laboratório: lute contra bugs, junte itens raros e suba de cargo.
            </blockquote>
            <ul className="ar-perks">
              <li>Combate automático, com um toque seu na hora certa</li>
              <li>Itens com raridade, de comum a lendário</li>
              <li>Cada cargo rende um bônus de ADScoins na sala de aula</li>
            </ul>
            <p className="hire-tagline">O botão do Hackathon fica no topo da tela. A sala de aula continua produzindo enquanto você luta.</p>
          </div>
        </div>
        <div className="scene-actions">
          <Button
            size="lg"
            onClick={() => {
              setMode('hackathon');
              onClose();
            }}
          >
            Ir ao Hackathon
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Depois
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
