import type { ProfessorId } from '@/game/content/types';
import { ASSETS } from '@/ui/art/manifest';
import { characterSprite } from '../../shared/characterProps';

/** Square crop of the head, chin at the bottom edge, at native pixel size. */
const SIZE = 48;

interface PlayerAvatarProps {
  professor: ProfessorId;
  skin: string;
}

/**
 * The player's professor wearing their skin, as a head crop. A single static SVG image, so 100 of them
 * cost nothing next to a full animated Character.
 */
export function PlayerAvatar({ professor, skin }: PlayerAvatarProps) {
  const sprite = characterSprite(professor, skin);
  const meta = ASSETS[sprite.head];
  return (
    <span className="community-avatar" aria-hidden="true">
      {meta ? (
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`${Math.round((meta.w - SIZE) / 2)} ${meta.h - SIZE} ${SIZE} ${SIZE}`}
          shapeRendering="crispEdges"
        >
          <image href={`/assets/${sprite.head}.png`} width={meta.w} height={meta.h} />
        </svg>
      ) : null}
    </span>
  );
}
