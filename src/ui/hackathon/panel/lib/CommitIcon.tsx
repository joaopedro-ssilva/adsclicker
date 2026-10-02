

/** A 12x12 coin, drawn like the kit's icons so it stays crisp at multiples of 12. Colour: currentColor. */
const COIN = [
  '...######...',
  '..########..',
  '.##########.',
  '####....####',
  '####.##.####',
  '####.##.####',
  '####.##.####',
  '####.##.####',
  '####....####',
  '.##########.',
  '..########..',
  '...######...',
] as const;

function path(): string {
  const commands: string[] = [];
  COIN.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) commands.push(`M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`);
  });
  return commands.join('');
}

const COIN_PATH = path();

/** The Commits currency mark (the ADScoin keeps the kit's own coin icon). */
export function CommitIcon({ size = 12 }: { size?: number }) {

  const pixels = Math.max(1, Math.round(size / 12)) * 12;
  return (
    <svg className="hk-commit-icon" width={pixels} height={pixels} viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d={COIN_PATH} />
    </svg>
  );
}
