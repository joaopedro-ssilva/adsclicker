import { ASSETS } from '@/ui/art/manifest';

/** The top of a professor's head sprite at 1x, cropped to a square: a compact portrait for switchers. */
export function HeadThumb({ professorId }: { professorId: string }) {
  const key = `heads/${professorId}`;
  const meta = ASSETS[key];
  if (!meta) return null;
  const size = Math.min(meta.w, meta.h);
  return (
    <svg
      className="head-thumb"
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
