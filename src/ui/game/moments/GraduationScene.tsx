'use client';
import { useEffect, useState } from 'react';
import { content, useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { Button, Icon } from '@/ui/kit';
import { CountUp } from './CountUp';
import { GraduationSummary } from './GraduationSummary';
import { SceneOverlay } from './SceneOverlay';

interface GraduationSceneProps {
  diplomas: number;
  onClose: () => void;
}

const BURSTS = 7;

/**
 * Full-screen graduation: diplomas counted up, confetti from all sides, what they give for good. A button opens the
 * summary of the turma that just ended; "Nova turma" (or Esc) skips straight to the next one.
 */
export function GraduationScene({ diplomas, onClose }: GraduationSceneProps) {
  const bonus = Math.round(content.balance.graduation.bonusPerDiploma * 100);
  const { maxBonus } = content.balance.graduation;
  const lastRun = useGame((store) => store.state.lastRun);
  const records = useGame((store) => store.state.records);
  const [page, setPage] = useState<'diplomas' | 'summary'>('diplomas');
  const hasSummary = lastRun?.summary !== undefined;

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
      {page === 'summary' && lastRun ? (
        <div className="gradscene">
          <GraduationSummary run={lastRun} records={records} />
          <div className="scene-actions">
            <Button size="lg" onClick={onClose} data-qa="graduation-close">
              Nova turma
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setPage('diplomas')}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
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
            Cada diploma dá <b>+{bonus}% de produção</b> para sempre{maxBonus === undefined ? '' : `, até +${Math.round(maxBonus * 100)}%`}, e abre a árvore de Formatura. A turma recomeça mais
            forte.
          </p>
          <div className="scene-actions">
            <Button size="lg" onClick={onClose} data-qa="graduation-close">
              Nova turma
            </Button>
            {hasSummary ? (
              <Button variant="secondary" size="lg" onClick={() => setPage('summary')} data-qa="graduation-summary-open">
                Resumo da turma
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </SceneOverlay>
  );
}
