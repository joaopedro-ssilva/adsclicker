import { ASSETS } from '@/ui/art/manifest';

interface ItemSpriteProps {
  /** ItemBaseDef.asset: "hackathon/items/<id>". */
  asset: string;
  /** Whole-number zoom of the native pixels. */
  scale?: number;
}

/** An item sprite in a box of its native size times an integer zoom, so pixels stay crisp. */
export function ItemSprite({ asset, scale = 3 }: ItemSpriteProps) {
  const meta = ASSETS[asset];
  return (
    <span
      className="ar-sprite"
      aria-hidden="true"
      style={{
        width: (meta?.w ?? 28) * scale,
        height: (meta?.h ?? 28) * scale,
        backgroundImage: `url(/assets/${asset}.png)`,
      }}
    />
  );
}
