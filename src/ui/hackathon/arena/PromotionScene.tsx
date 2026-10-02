'use client';
import { useEffect } from 'react';
import { useCloud } from '@/game/cloud';
import type { CargoId } from '@/hackathon/content';
import { Character } from '@/ui/art/Character';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { SceneOverlay } from '@/ui/game/moments/SceneOverlay';
import { Button } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { useHackathon } from '../store';
import { cargoById } from '../shared/lookup';
import { studentSprite } from './studentSprite';

interface PromotionSceneProps {
  cargo: CargoId;
  onClose: () => void;
}

/** A promotion takes the screen: the student walks in wearing the new cargo. */
export function PromotionScene({ cargo, onClose }: PromotionSceneProps) {
  const profile = useHackathon((store) => store.profile);
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const tall = useMediaQuery('(min-height: 760px)');
  const def = cargoById.get(cargo);
  const previous = [...cargoById.values()].find((candidate) => candidate.order === (def?.order ?? 1) - 1);

  useEffect(() => {
    audio.play('graduate');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const timers = [
      setTimeout(() => fx.confetti({ x: w * 0.5, y: h * 0.35, count: 110 }), 450),
      setTimeout(() => fx.sparkles({ x: w * 0.5, y: h * 0.45, count: 50, color: '#f7ca75' }), 750),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!def || !profile) return null;
  const perks: string[] = [];
  if (def.classroomMultiplier > (previous?.classroomMultiplier ?? 1)) {
    perks.push(`ADScoins ×${String(def.classroomMultiplier).replace('.', ',')} na sala de aula`);
  }
  if (def.skillSlots > (previous?.skillSlots ?? 0)) perks.push(`${def.skillSlots} habilidades ativas na luta`);
  perks.push(`Níveis até ${def.maxLevel}`);

  return (
    <SceneOverlay label={`Promoção: ${def.name}`} accent="#f7ca75" variant="graduate" onClose={onClose}>
      <div className="hire">
        <p className="scene-kicker">Promoção!</p>
        <div className="hire-stage">
          <div className="hire-actor">
            <Character {...studentSprite(profile.head, cargo, nickname ?? 'Aluno')} scale={tall ? 5 : 4} label={def.name} />
          </div>
          <div className="hire-card">
            <h3 className="scene-title">{def.name}</h3>
            <p className="hire-subject">{nickname ?? 'Seu aluno'} subiu de cargo</p>
            <ul className="ar-perks">
              {perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="scene-actions">
          <Button size="lg" onClick={onClose}>
            Continuar
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
