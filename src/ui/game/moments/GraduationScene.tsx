'use client';
import { useEffect } from 'react';
import { content } from '@/game/store';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { Button, Icon } from '@/ui/kit';
import { CountUp } from './CountUp';
import { SceneOverlay } from './SceneOverlay';

interface GraduationSceneProps {
  diplomas: number;
  onClose: () => void;
}

const BURSTS = 7;

/** Full-screen graduation: diplomas counted up, confetti from all sides, what they give for good. */
export function GraduationScene({ diplomas, onClose }: GraduationSceneProps) {
  const bonus = Math.round(content.balance.graduation.bonusPerDiploma * 100);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let burst = 0; burst < BURSTS; burst += 1) {
      timers.push(
        setTimeout(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          fx.confetti({ x: w * (0.15 + ((burst * 0.37) % 0.7)), y: h * (0.25 + (burst % 3) * 0.12), count: 90 });
        }, 300 + burst * 520),
      );
    }
    timers.push(setTimeout(() => audio.play('milestone'), 1400));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <SceneOverlay label="Formatura" variant="graduate" accent="#f59e0b" onClose={onClose}>
      <div className="gradscene">
        <p className="scene-kicker">Formatura</p>
        <div className="gradscene-diploma" aria-hidden="true">
          <Icon name="diploma" size={96} />
        </div>
        <p className="gradscene-count">
          +<CountUp value={diplomas} durationMs={1400} />
        </p>
        <h3 className="scene-title">{diplomas === 1 ? 'Diploma conquistado' : 'Diplomas conquistados'}</h3>
        <p className="gradscene-note">
          Cada diploma dá <b>+{bonus}% de produção</b> para sempre e abre a árvore de Formatura. A turma recomeça mais
          forte.
        </p>
        <div className="scene-actions">
          <Button size="lg" onClick={onClose}>
            Nova turma
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
