import type { PixelPath } from './pixelGrid';

/** Draws the paths of a PixelGrid inside an svg whose viewBox is in sprite pixels. */
export function PixelPaths({ paths }: { paths: PixelPath[] }) {
  return (
    <>
      {paths.map(({ color, d }) => (
        <path key={color} fill={color} d={d} />
      ))}
    </>
  );
}
