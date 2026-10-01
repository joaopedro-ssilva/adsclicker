import { useMemo, type SVGProps } from 'react';
import { iconBitmaps } from './iconBitmaps';

export type IconName = keyof typeof iconBitmaps;
export const iconNames = Object.keys(iconBitmaps) as IconName[];

const GRID = 12;

/** Merges horizontal runs of filled pixels into one SVG path. */
function bitmapPath(rows: readonly string[]): string {
  const commands: string[] = [];
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) {
      commands.push(`M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`);
    }
  });
  return commands.join('');
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Rendered size in px. Snapped to a multiple of 12 so every icon pixel is a whole number of screen pixels. */
  size?: number;
  /** Accessible name. Without it the icon is decorative and hidden from assistive tech. */
  title?: string;
}

export function Icon({ name, size = 24, title, ...props }: IconProps) {
  const path = useMemo(() => bitmapPath(iconBitmaps[name]), [name]);
  const pixels = Math.max(1, Math.round(size / GRID)) * GRID;

  return (
    <svg
      width={pixels}
      height={pixels}
      viewBox={`0 0 ${GRID} ${GRID}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...props}
    >
      <path d={path} />
    </svg>
  );
}
