import { ASSETS } from '@/ui/art/manifest';

interface HeadPortraitProps {
  professorId: string;
  /** Initial shown when the head art does not exist yet. */
  fallback: string;
}

/** A professor's head at native size (crisp), cropped to a square. Falls back to the initial. */
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
  const size = Math.min(meta.w, meta.h);
  return (
    <svg
      className="roster-portrait"
      width={size}
      height={size}
      viewBox={`${(meta.w - size) / 2} 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <image href={`/assets/${key}.png`} width={meta.w} height={meta.h} />
    </svg>
  );
}
