import type { CSSProperties, ReactNode } from 'react';
import { cssVariables } from '@/ui/theme';
import { mythicEffectOf, pixelShadow } from './mythicEffects';
import type { MythicKind } from './mythicEffects';

/**
 * The effect behind and around a mythic professor, one per skin (the table is in mythicEffects.ts, the styles in mythic.css).
 * Everything is CSS: hard-edged shapes, stepped animations, no blur. Each layer is invisible until its animation runs, so
 * reduced motion (which cancels animations) shows none of it. Sizes are in container units of the aura, so the effect
 * follows the size of the professor on the stage and in photo mode.
 */

// --- Pixel drawings (one empty element of `unit` pixels draws a whole sprite with box-shadows) ---------------------

const THUMB = pixelShadow(
  ['....oo....', '...ohho...', '...ofho...', 'oooofffoo.', 'occofffffo', 'occofffffo', 'occofffffo', '.oooooooo.'],
  { o: '#3b2a05', h: '#ffffff', f: 'var(--fx)', c: '#b8860b' },
  3,
);

const CLOUD = pixelShadow(
  [
    '......eeee..........',
    '....eemmmmee..eee...',
    '..eemmmmmmmmeemmme..',
    '.emmmmmbbbmmmmmmmme.',
    'emmbbbbbbbbbbbbbbbbe',
    'ebbbbbbbbbbbbbbbbbbe',
    '.dddbbbbbbbddddbbdd.',
    '..dd..dddd....dd....',
  ],
  { e: '#7d86ad', m: '#4a5378', b: '#2c3250', d: '#1a1d31' },
  6,
);

const STAR_SMALL = pixelShadow(['.o.', 'owo', '.o.'], { o: 'var(--fx2)', w: '#ffffff' }, 3);
const STAR_BIG = pixelShadow(['..o..', '..o..', 'ooWoo', '..o..', '..o..'], { o: 'var(--fx2)', W: '#ffffff' }, 3);

const LEAF = pixelShadow(['....gg', '...ggg', '..gggG', '.gggG.', 'gggG..', 'gG....'], { g: 'var(--leaf)', G: 'var(--leaf2)' }, 3);

const px = (shadow: string): CSSProperties => ({ boxShadow: shadow });
const at = (vars: Record<`--${string}`, string | number>): CSSProperties =>
  cssVariables(Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, String(value)])) as Record<`--${string}`, string>);

// --- Layers -------------------------------------------------------------------------------------------------------

/** Edécio: golden rays turning slowly behind him and thumbs-up rising. */
const THUMBS = [
  { x: 6, d: 0, t: 5.2, dx: -4 },
  { x: 18, d: 1.6, t: 6.1, dx: 3 },
  { x: 30, d: 3.1, t: 5.6, dx: -2 },
  { x: 44, d: 0.8, t: 6.4, dx: 2 },
  { x: 58, d: 2.4, t: 5.4, dx: -3 },
  { x: 70, d: 3.9, t: 6.0, dx: 4 },
  { x: 82, d: 1.1, t: 5.8, dx: -2 },
  { x: 92, d: 2.9, t: 6.3, dx: 3 },
];

function Sunburst() {
  return (
    <>
      <span className="fx-rays" />
      <span className="fx-rays fx-rays-inner" />
      {THUMBS.map((thumb, index) => (
        <i key={index} className="fx-thumb" style={{ ...px(THUMB), ...at({ '--x': `${thumb.x}%`, '--d': `${thumb.d}s`, '--t': `${thumb.t}s`, '--dx': thumb.dx }) }} />
      ))}
    </>
  );
}

/** Gladimir (the robot): scanning lines, blue data bits floating up and pulses from the antennas. */
const BITS = [8, 15, 22, 29, 36, 43, 57, 64, 71, 78, 85, 92];

function Scan() {
  return (
    <>
      <span className="fx-frame" />
      <span className="fx-lines" />
      <span className="fx-sweep" />
      {BITS.map((x, index) => (
        <i key={index} className="fx-bit" style={at({ '--x': `${x}%`, '--d': `${(index * 0.73) % 4.2}s`, '--t': `${3.4 + (index % 4) * 0.5}s`, '--dx': (index % 3) - 1 })} />
      ))}
      <span className="fx-ping" style={at({ '--x': '44.5%', '--d': '0s' })} />
      <span className="fx-ping" style={at({ '--x': '55.5%', '--d': '0.9s' })} />
    </>
  );
}

/** Bruna B2: white light splits into a spectrum that sweeps around her. */
const SPECTRUM = ['#ff4d4d', '#ff9f40', '#ffe14d', '#4dff88', '#4dc3ff', '#8a6bff', '#ff7ad9'];

function Prism() {
  return (
    <>
      <span className="fx-fan">
        <i className="fx-beam fx-beam-white" style={at({ '--a': '180deg' })} />
        {SPECTRUM.map((color, index) => (
          <i key={color} className="fx-beam" style={at({ '--a': `${(index - 3) * 8}deg`, '--c': color })} />
        ))}
      </span>
      <span className="fx-fan fx-fan-back">
        <i className="fx-beam fx-beam-white" style={at({ '--a': '180deg' })} />
        {SPECTRUM.map((color, index) => (
          <i key={color} className="fx-beam" style={at({ '--a': `${(index - 3) * 8}deg`, '--c': color })} />
        ))}
      </span>
    </>
  );
}

/** Wagner: red hexagonal plates orbiting, and now and then a scan sweeping across. */
const PLATES = [0, 1, 2, 3, 4, 5];

function Shield() {
  return (
    <>
      <span className="fx-orbit">
        {PLATES.map((plate) => (
          <span key={plate} className="fx-arm" style={at({ '--a': `${plate * 60}deg` })}>
            <i className="fx-hex" />
          </span>
        ))}
      </span>
      <span className="fx-scan" />
    </>
  );
}

/** Guto: dark clouds overhead and lightning that strikes at intervals. */
const CLOUDS = [
  { x: 2, y: 1, t: 46, d: 0 },
  { x: 38, y: -3, t: 58, d: -20 },
  { x: 70, y: 2, t: 52, d: -9 },
];
const STRIKES = [
  { x: 14, d: 1.4, t: 6.3 },
  { x: 76, d: 4.6, t: 8.1 },
  { x: 38, d: 7.2, t: 9.4 },
];

function Storm() {
  return (
    <>
      {STRIKES.map((strike, index) => (
        <span key={`flash${index}`} className="fx-flash" style={at({ '--x': `${strike.x}%`, '--d': `${strike.d}s`, '--t': `${strike.t}s` })} />
      ))}
      {CLOUDS.map((cloud, index) => (
        <i key={`cloud${index}`} className="fx-cloud" style={{ ...px(CLOUD), ...at({ '--x': `${cloud.x}%`, '--y': `${cloud.y}%`, '--t': `${cloud.t}s`, '--d': `${cloud.d}s` }) }} />
      ))}
      {STRIKES.map((strike, index) => (
        <span key={`bolt${index}`} className="fx-bolt" style={at({ '--x': `${strike.x}%`, '--d': `${strike.d}s`, '--t': `${strike.t}s` })}>
          <i />
        </span>
      ))}
    </>
  );
}

/** Bruna B1: constellation points appear and join with lines, and star dust falls. */
const POINTS: [number, number][] = [
  [10, 62],
  [20, 36],
  [33, 16],
  [50, 28],
  [67, 12],
  [80, 34],
  [91, 58],
];
const DUST = [6, 14, 22, 31, 40, 52, 61, 70, 78, 86, 94];

function Constellation() {
  return (
    <>
      <svg className="fx-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        {POINTS.slice(1).map(([x, y], index) => {
          const [fromX, fromY] = POINTS[index]!;
          return <line key={index} className="fx-link" x1={fromX} y1={fromY} x2={x} y2={y} pathLength={100} style={at({ '--d': `${index * 0.9 + 0.25}s` })} />;
        })}
      </svg>
      {POINTS.map(([x, y], index) => (
        <i key={index} className="fx-star" style={{ ...px(index % 3 === 1 ? STAR_BIG : STAR_SMALL), ...at({ '--x': `${x}%`, '--y': `${y}%`, '--d': `${index * 0.9}s` }) }} />
      ))}
      {DUST.map((x, index) => (
        <i key={`dust${index}`} className="fx-dust" style={at({ '--x': `${x}%`, '--d': `${(index * 0.97) % 5}s`, '--t': `${4 + (index % 4) * 0.7}s`, '--dx': (index % 2 ? 4 : -4) })} />
      ))}
    </>
  );
}

/** Angelo: laurel leaves and gold confetti drifting down, under a soft white-gold halo in bands. */
const LEAVES = [8, 19, 31, 45, 58, 69, 81, 91];
const CHIPS = [4, 13, 24, 36, 48, 54, 63, 74, 84, 94];

function Laurel() {
  return (
    <>
      <span className="fx-halo" />
      {LEAVES.map((x, index) => (
        <i
          key={`leaf${index}`}
          className="fx-leaf"
          style={{
            ...px(LEAF),
            ...at({ '--x': `${x}%`, '--d': `${(index * 1.13) % 6}s`, '--t': `${6.5 + (index % 3)}s`, '--dx': (index % 2 ? 7 : -7), '--leaf': index % 2 ? '#4f9d52' : '#d7a935', '--leaf2': index % 2 ? '#2d6a35' : '#9a7416' }),
          }}
        />
      ))}
      {CHIPS.map((x, index) => (
        <i key={`chip${index}`} className="fx-chip" style={at({ '--x': `${x}%`, '--d': `${(index * 0.83) % 5}s`, '--t': `${5 + (index % 4) * 0.8}s`, '--dx': (index % 2 ? 5 : -5) })} />
      ))}
    </>
  );
}

/** Pablo: a slow orbit of stars, an accretion ring that swirls, and bits being pulled inward. */
const ORBIT_STARS = [0, 1, 2, 3, 4, 5];
const PULLS = [
  [-78, -20],
  [-62, 42],
  [-40, -58],
  [-18, 66],
  [8, -70],
  [30, 62],
  [54, -46],
  [74, 18],
  [66, 52],
  [-70, 8],
  [20, -74],
  [-34, 60],
] as const;

function Singularity() {
  return (
    <>
      <span className="fx-disk">
        <i />
      </span>
      <span className="fx-orbit fx-orbit-slow">
        {ORBIT_STARS.map((star) => (
          <span key={star} className="fx-arm" style={at({ '--a': `${star * 60}deg` })}>
            <i className="fx-orb" style={{ ...px(star % 2 ? STAR_BIG : STAR_SMALL), ...at({ '--d': `${star * 0.7}s` }) }} />
          </span>
        ))}
      </span>
      {PULLS.map(([sx, sy], index) => (
        <i key={index} className="fx-pull" style={at({ '--sx': sx, '--sy': sy, '--d': `${(index * 0.61) % 3.6}s`, '--t': `${2.8 + (index % 3) * 0.6}s` })} />
      ))}
    </>
  );
}

const LAYERS: Record<MythicKind, () => ReactNode> = {
  sunburst: Sunburst,
  scan: Scan,
  prism: Prism,
  shield: Shield,
  storm: Storm,
  constellation: Constellation,
  laurel: Laurel,
  singularity: Singularity,
};

/** The effect of a mythic skin; nothing for a skin that has none. */
export function MythicAura({ skinId, scale }: { skinId: string; scale: number }) {
  const effect = mythicEffectOf(skinId);
  if (!effect) return null;
  const Layers = LAYERS[effect.kind];
  return (
    <div className="mythic-aura" data-fx={effect.kind} aria-hidden="true" style={at({ '--fx': effect.color, '--fx2': effect.accent, '--u': scale })}>
      <Layers />
    </div>
  );
}

