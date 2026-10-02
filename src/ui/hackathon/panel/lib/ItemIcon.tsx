import { ASSETS } from '@/ui/art/manifest';

interface ItemIconProps {
  /** ItemBaseDef.asset: "hackathon/items/<id>". */
  asset: string;
  /** Whole-number zoom of the native pixels. */
  scale?: number;
  /** Dark silhouette, for things not found yet. */
  hidden?: boolean;
}

/** An item sprite at an integer zoom. A box of the native size, so every pixel is a whole number of screen pixels. */
export function ItemIcon({ asset, scale = 2, hidden = false }: ItemIconProps) {
  const meta = ASSETS[asset];
  const width = (meta?.w ?? 28) * scale;
  const height = (meta?.h ?? 28) * scale;
  return (
    <span
      className="hk-icon"
      data-hidden={hidden}
      aria-hidden="true"
      style={{ width, height, backgroundImage: `url(/assets/${asset}.png)` }}
    />
  );
}
