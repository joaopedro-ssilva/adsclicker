'use client';
import { itemArtSrc } from './labFormat';

interface ItemArtProps {
  /** The base's content path ("hackathon/items/teclado-mecanico"). */
  asset: string;
  name: string;
  /** Side of the square, in px. */
  size?: number;
}

/**
 * The picture of an item. The art is high-resolution (about 200 px), not pixel art: it scales smoothly, unlike the
 * game's sprites (lab.css sets image-rendering: auto).
 */
export function ItemArt({ asset, name, size = 72 }: ItemArtProps) {
  return (
    <span className="lab-art" role="img" aria-label={name} style={{ width: size, height: size, backgroundImage: `url(${itemArtSrc(asset)})` }} />
  );
}
