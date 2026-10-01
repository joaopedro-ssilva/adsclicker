import { content } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import { ASSETS } from '@/ui/art/manifest';

interface PortraitProps {
  professor: ProfessorId;
  /** Whole-number zoom of the native sprite pixels. */
  zoom?: number;
}

/** The top of a professor's head sprite, cropped to a square: a compact portrait at an integer pixel scale. */
export function Portrait({ professor, zoom = 1 }: PortraitProps) {
  const meta = ASSETS[`heads/${professor}`];
  if (!meta) {
    const initial = content.professors[professor].name.slice(0, 1);
    return (
      <span className="panel-portrait panel-portrait-fallback" style={{ width: 44 * zoom, height: 44 * zoom }} aria-hidden="true">
        {initial}
      </span>
    );
  }
  const size = Math.min(meta.w, meta.h);
  return (
    <svg
      className="panel-portrait"
      width={size * zoom}
      height={size * zoom}
      viewBox={`${(meta.w - size) / 2} 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <image href={`/assets/heads/${professor}.png`} width={meta.w} height={meta.h} />
    </svg>
  );
}
