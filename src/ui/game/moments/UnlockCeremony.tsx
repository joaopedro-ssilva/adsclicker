'use client';
import { useEffect } from 'react';
import { fx } from '@/ui/fx';
import { Button, RarityBadge } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { equipUnlock } from './equipUnlock';
import type { UnlockMoment } from './momentsStore';
import { SceneOverlay } from './SceneOverlay';
import { KIND_LABEL, unlockCaption, unlockSubject } from './unlockInfo';
import { UnlockPreview } from './UnlockPreview';

interface UnlockCeremonyProps {
  moment: UnlockMoment;
  onClose: () => void;
}

const RARITY_COLOR = { common: '#a7acba', rare: '#79b7ff', epic: '#c69bff', legendary: '#f7ca75' } as const;

/**
 * Epic and legendary unlocks take the screen. Epic is a centred card with sparkles; legendary is the whole screen
 * with rays and several confetti bursts. Common and rare ones use the quick corner card instead.
 */
export function UnlockCeremony({ moment, onClose }: UnlockCeremonyProps) {
  const subject = unlockSubject(moment);
  const narrow = useMediaQuery('(max-width: 640px)');
  const legendary = moment.rarity === 'legendary';
  const color = RARITY_COLOR[moment.rarity];

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => fx.sparkles({ x: w / 2, y: h * 0.42, count: legendary ? 80 : 45, color }), 350)];
    if (legendary) {
      [0, 1, 2, 3].forEach((burst) =>
        timers.push(
          setTimeout(() => fx.confetti({ x: w * (0.2 + burst * 0.2), y: h * (0.3 + (burst % 2) * 0.1), count: 100 }), 500 + burst * 450),
        ),
      );
      timers.push(setTimeout(() => fx.shake({ intensity: 6, duration: 420 }), 380));
    } else {
      timers.push(setTimeout(() => fx.confetti({ x: w / 2, y: h * 0.35, count: 50 }), 520));
    }
    return () => timers.forEach(clearTimeout);
  }, [legendary, color]);

  if (!subject) return null;
  return (
    <SceneOverlay
      label={`${KIND_LABEL[subject.item]}: ${subject.def.name}`}
      variant={legendary ? 'legendary' : 'unlock'}
      accent={color}
      onClose={onClose}
    >
      <div className="unlock-big" data-rarity={moment.rarity}>
        <p className="scene-kicker">{KIND_LABEL[subject.item]}</p>
        <div className="unlock-stage" data-item={subject.item}>
          <UnlockPreview subject={subject} scale={legendary && !narrow ? 4 : 3} />
        </div>
        <RarityBadge rarity={moment.rarity} />
        <h3 className="scene-title">{subject.def.name}</h3>
        <p className="unlock-caption">{unlockCaption(subject)}</p>
        <div className="scene-actions">
          <Button
            size="lg"
            onClick={() => {
              equipUnlock(subject);
              onClose();
            }}
          >
            Equipar agora
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Depois
          </Button>
        </div>
      </div>
    </SceneOverlay>
  );
}
