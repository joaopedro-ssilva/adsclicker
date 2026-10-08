import { ASSETS } from '@/ui/art/manifest';

interface HeadPortraitProps {
  professorId: string;
  /** Initial shown when the head art does not exist yet. */
  fallback: string;
}

/**
 * A professor's whole head, never cropped: at native size when it fits the frame, scaled down to fit when the
 * head is taller or wider than it (long hair, a tall forehead). Falls back to the initial.
 */
export function HeadPortrait({ professorId, fallback }: HeadPortraitProps) {
  const key = `heads/${professorId}`;
  const meta = ASSETS[key];
  if (!meta) {
    return (
      <span className="roster-portrait-fallback" aria-hidden="true">
        {fallback.slice(0, 1)}
      </span>
    );
  }
  return (
    <svg
      className="roster-portrait"
      viewBox={`0 0 ${meta.w} ${meta.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', maxWidth: meta.w, maxHeight: meta.h, padding: 2, boxSizing: 'border-box' }}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <image href={`/assets/${key}.png`} width={meta.w} height={meta.h} />
    </svg>
  );
}
