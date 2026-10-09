import { cssVariables } from '@/ui/theme';

/** Position (% of the box), pixel size, delay and duration of each sparkle. Fixed, so the aura never re-rolls. */
// They sit on the sides and above the professor: one behind the body would never be seen.
const SPARKLES = [
  { x: 4, y: 16, s: 2, d: 0, t: 2.6 },
  { x: 12, y: 44, s: 3, d: 1.1, t: 3.2 },
  { x: 7, y: 70, s: 2, d: 2.0, t: 2.8 },
  { x: 20, y: 86, s: 2, d: 0.5, t: 3.0 },
  { x: 24, y: 28, s: 2, d: 2.6, t: 2.7 },
  { x: 16, y: 58, s: 1, d: 1.6, t: 2.4 },
  { x: 36, y: 96, s: 2, d: 1.9, t: 3.1 },
  { x: 50, y: 100, s: 3, d: 0.8, t: 3.3 },
  { x: 64, y: 95, s: 2, d: 2.9, t: 2.9 },
  { x: 78, y: 84, s: 2, d: 0.2, t: 2.6 },
  { x: 76, y: 30, s: 2, d: 1.4, t: 3.0 },
  { x: 84, y: 56, s: 1, d: 2.3, t: 2.5 },
  { x: 88, y: 42, s: 3, d: 0.6, t: 3.2 },
  { x: 93, y: 68, s: 2, d: 1.8, t: 2.8 },
  { x: 96, y: 18, s: 2, d: 2.5, t: 2.7 },
  { x: 2, y: 34, s: 1, d: 3.1, t: 2.4 },
];

/** A banded halo and pixel sparkles around a mythic skin (the hard outline on the sprite itself is in mythic.css). Everything is animation-driven, so reduced motion hides it. */
export function MythicAura() {
  return (
    <div className="mythic-aura" aria-hidden="true">
      <span className="mythic-aura-glow" />
      {SPARKLES.map((spark, index) => (
        <i
          key={index}
          style={cssVariables({
            '--x': `${spark.x}%`,
            '--y': `${spark.y}%`,
            '--s': String(spark.s),
            '--d': `${spark.d}s`,
            '--t': `${spark.t}s`,
          })}
        />
      ))}
    </div>
  );
}
