'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkinDef } from '@/game/content/types';
import { cssVariables } from '../theme';
import { useReducedMotion } from '../useReducedMotion';
import { ASSETS } from './manifest';
import { PixelPaths } from './PixelPaths';
import { hashSeed } from './procedural';
import { drawBody, PROCEDURAL_BODY } from './proceduralBody';
import { drawHat, PROCEDURAL_HAT } from './proceduralHat';
import { drawHead, pickSkinTone, PROCEDURAL_HEAD } from './proceduralHead';
import { useSpriteSkinTone } from './spriteTone';

export interface CharacterProps {
  /** Asset keys relative to public/assets, without extension: "skins/edecio-default", "heads/edecio", "hats/edecio-samurai". */
  body?: string;
  head?: string;
  hat?: string;
  /** Colours of the procedural fallback outfit (SkinDef.palette). */
  palette: SkinDef['palette'];
  /** Drives the procedural head (skin, hair, glasses, beard) and the idle animation phase. */
  seed: string;
  /** Whole-number zoom of the native sprite pixels. Default 3. */
  scale?: number;
  /** Change this number to play the click squash. */
  bump?: number;
  /** Breathing bob. Default true. Always off with reduced motion. */
  idle?: boolean;
  /** Pixel contact shadow under the feet. Default true. */
  shadow?: boolean;
  /** Accessible name of the image. */
  label?: string;
  className?: string;
}

interface Layout {
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const SQUASH = [
  { transform: 'scale(1.16, 0.82)', filter: 'brightness(1.35)' },
  { transform: 'scale(0.95, 1.07)', filter: 'brightness(1.1)', offset: 0.5 },
  { transform: 'scale(1)', filter: 'brightness(1)' },
];

interface Placed {
  w: number;
  h: number;
  anchor: { x: number; y: number };
}

function hasAsset(key: string | undefined, failed: readonly string[]): key is string {
  return key !== undefined && key in ASSETS && !failed.includes(key);
}

function placed(key: string | undefined, fallback: Placed): Placed {
  const meta = key ? ASSETS[key] : undefined;
  return meta ? { w: meta.w, h: meta.h, anchor: meta.anchor ?? fallback.anchor } : fallback;
}

/** All coordinates are in native sprite pixels. The head's chin goes on the body's neck, the hat on the top of the head. */
function computeLayout(body: Placed, head: Placed, hat: Placed | undefined, shadow: boolean): Layout {
  const hx = body.anchor.x - head.anchor.x;
  const hy = body.anchor.y - head.anchor.y;
  const tx = hat ? hx + Math.floor(head.w / 2) - hat.anchor.x : 0;
  const ty = hat ? hy - hat.anchor.y : 0;
  const left = Math.min(0, hx, hat ? tx : 0);
  const top = Math.min(0, hy, hat ? ty : 0);
  const right = Math.max(body.w, hx + head.w, hat ? tx + hat.w : 0);
  const bottom = body.h + (shadow ? 2 : 0);
  return { hx, hy, tx, ty, left, top, width: right - left, height: bottom - top };
}

/**
 * A professor as three pixel layers: body (skin), head and optional hat. The head's chin sits on the body's neck and
 * the hat rests on the top of the head. Any layer without art falls back to a deterministic procedural sprite.
 */
export function Character({
  body,
  head,
  hat,
  palette,
  seed,
  scale = 3,
  bump = 0,
  idle = true,
  shadow = true,
  label = 'Professor em pixel art',
  className,
}: CharacterProps) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState<string[]>([]);
  const squash = useRef<HTMLDivElement>(null);
  const lastBump = useRef(bump);

  const realBody = hasAsset(body, failed) ? body : undefined;
  const realHead = hasAsset(head, failed) ? head : undefined;
  const realHat = hasAsset(hat, failed) ? hat : undefined;
  const wantsHat = hat !== undefined;

  // A procedural body next to a real head takes the head's skin colour so hands and neck match.
  const sampledTone = useSpriteSkinTone(!realBody && realHead ? realHead : undefined);
  const tone = sampledTone ?? pickSkinTone(seed);

  const { primary, secondary, accent } = palette;
  const bodyPaths = useMemo(
    () => (realBody ? [] : drawBody(seed, { primary, secondary, accent }, tone).paths()),
    [realBody, seed, primary, secondary, accent, tone],
  );
  const headPaths = useMemo(() => (realHead ? [] : drawHead(seed, tone).paths()), [realHead, seed, tone]);
  const hatPaths = useMemo(
    () => (wantsHat && !realHat ? drawHat(hat, { primary, secondary, accent }).paths() : []),
    [wantsHat, realHat, hat, primary, secondary, accent],
  );

  const bodyMeta = placed(realBody, { w: PROCEDURAL_BODY.w, h: PROCEDURAL_BODY.h, anchor: PROCEDURAL_BODY.neck });
  const headMeta = placed(realHead, { w: PROCEDURAL_HEAD.w, h: PROCEDURAL_HEAD.h, anchor: PROCEDURAL_HEAD.chin });
  const hatMeta = placed(realHat, { w: PROCEDURAL_HAT.w, h: PROCEDURAL_HAT.h, anchor: PROCEDURAL_HAT.anchor });
  const layout = computeLayout(bodyMeta, headMeta, wantsHat ? hatMeta : undefined, shadow);

  const zoom = Number.isFinite(scale) ? Math.max(1, Math.floor(scale)) : 3;
  const markFailed = (key: string) => setFailed((previous) => (previous.includes(key) ? previous : [...previous, key]));
  const animated = idle && !reduced;

  useEffect(() => {
    if (lastBump.current === bump) return;
    lastBump.current = bump;
    if (reduced) return;
    const animation = squash.current?.animate(SQUASH, { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    return () => animation?.cancel();
  }, [bump, reduced]);

  const style = {
    ...cssVariables({ '--bob-delay': `-${(hashSeed(seed) % 16) / 10}s` }),
    width: layout.width * zoom,
    height: layout.height * zoom,
  };

  return (
    <div className={className ? `character ${className}` : 'character'} style={style} data-idle={animated}>
      <div className="character-squash" ref={squash}>
        <svg
          role="img"
          aria-label={label}
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`${layout.left} ${layout.top} ${layout.width} ${layout.height}`}
          shapeRendering="crispEdges"
        >
          {shadow ? (
            <g fill="rgb(0 0 0 / 0.28)">
              <rect x={bodyMeta.anchor.x - 14} y={bodyMeta.h - 2} width="28" height="1" />
              <rect x={bodyMeta.anchor.x - 17} y={bodyMeta.h - 1} width="34" height="2" />
              <rect x={bodyMeta.anchor.x - 14} y={bodyMeta.h + 1} width="28" height="1" />
            </g>
          ) : null}
          {realBody ? (
            <image href={`/assets/${realBody}.png`} width={bodyMeta.w} height={bodyMeta.h} onError={() => markFailed(realBody)} />
          ) : (
            <PixelPaths paths={bodyPaths} />
          )}
          <g className="character-head">
            <g transform={`translate(${layout.hx} ${layout.hy})`}>
              {realHead ? (
                <image href={`/assets/${realHead}.png`} width={headMeta.w} height={headMeta.h} onError={() => markFailed(realHead)} />
              ) : (
                <PixelPaths paths={headPaths} />
              )}
            </g>
            {wantsHat ? (
              <g transform={`translate(${layout.tx} ${layout.ty})`}>
                {realHat ? (
                  <image href={`/assets/${realHat}.png`} width={hatMeta.w} height={hatMeta.h} onError={() => markFailed(realHat)} />
                ) : (
                  <PixelPaths paths={hatPaths} />
                )}
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}
