'use client';
import { useEffect } from 'react';
import { content, useGame } from '@/game/store';
import type { ProfessorId } from '@/game/content/types';
import { Character } from '@/ui/art/Character';
import { fx } from '@/ui/fx';
import { Badge, Button } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { characterSprite } from '../shared/characterProps';
import { FEATURE_LABEL } from './featureLabels';
import { SceneOverlay } from './SceneOverlay';

interface HireSceneProps {
  professor: ProfessorId;
  onClose: () => void;
}

/** The new professor walks onto the screen in their own colour, says their line and names the layer they bring. */
export function HireScene({ professor: id, onClose }: HireSceneProps) {
  const professor = content.professors[id];
  const setActive = useGame((store) => store.setActiveProfessor);
  const skin = useGame((store) => store.state.equippedSkin[id]);
  const tall = useMediaQuery('(min-height: 760px)');

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const timers = [
      setTimeout(() => fx.confetti({ x: w * 0.5, y: h * 0.38, count: 80 }), 450),
      setTimeout(() => fx.sparkles({ x: w * 0.5, y: h * 0.45, count: 50, color: professor.color }), 700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [professor.color]);

  return (
    <SceneOverlay label={`${professor.name} entrou para a turma`} accent={professor.color} variant="hire" onClose={onClose}>
      <div className="hire">
        <p className="scene-kicker">Novo professor na turma</p>
        <div className="hire-stage">
          <div className="hire-actor">
            <Character {...characterSprite(id, skin)} scale={tall ? 4 : 3} label={professor.name} />
          </div>
          <div className="hire-card">
            <h3 className="scene-title">{professor.name}</h3>
            <p className="hire-subject">{professor.subject}</p>
            <blockquote className="hire-quote">{professor.quotes.hire}</blockquote>
            <div className="hire-gain">
              <p className="eyebrow">Agora você tem</p>
              <ul>
                {professor.features.map((feature) => (
                  <li key={feature}>
                    <Badge tone="accent">{FEATURE_LABEL[feature]}</Badge>
                  </li>
                ))}
              </ul>
              <p className="hire-tagline">{professor.tagline}</p>
            </div>
          </div>
        </div>
        <div className="scene-actions">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setActive(id);
              onClose();
            }}
          >
            Ver as aulas
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Continuar
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
