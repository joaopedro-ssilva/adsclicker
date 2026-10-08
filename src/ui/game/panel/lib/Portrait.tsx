import { content } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import { ASSETS } from '@/ui/art/manifest';

/** Side of the square frame in native pixels: the same for every professor, whatever the size of the head art. */
const FRAME = 48;

interface PortraitProps {
  professor: ProfessorId;
  /** Whole-number zoom of the native sprite pixels. */
  zoom?: number;
}

/** A professor's whole head in a square frame: a head taller or wider than the frame is scaled down to fit, never cropped. */
export function Portrait({ professor, zoom = 1 }: PortraitProps) {
  const meta = ASSETS[`heads/${professor}`];
  if (!meta) {
    const initial = content.professors[professor].name.slice(0, 1);
    return (
      <span className="panel-portrait panel-portrait-fallback" style={{ width: FRAME * zoom, height: FRAME * zoom }} aria-hidden="true">
        {initial}
      </span>
    );
  }
  return (
    <svg
      className="panel-portrait"
      width={FRAME * zoom}
      height={FRAME * zoom}
      style={{ aspectRatio: '1' }}
      viewBox={`0 0 ${meta.w} ${meta.h}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <image href={`/assets/heads/${professor}.png`} width={meta.w} height={meta.h} />
    </svg>
  );
}
