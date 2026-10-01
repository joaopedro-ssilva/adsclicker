'use client';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Ambient, SceneryDef } from '@/game/content/types';
import { AmbientParticles } from './AmbientParticles';
import { ASSETS } from './manifest';
import { PixelPaths } from './PixelPaths';
import { drawProceduralScenery, SCENERY_SIZE } from './proceduralScenery';

export interface SceneryProps {
  /** A SceneryDef works as is. Only id and palette are required. */
  scenery: Pick<SceneryDef, 'id' | 'palette'> & Partial<Pick<SceneryDef, 'asset' | 'ambient' | 'name'>>;
  /** Overrides scenery.ambient. */
  ambient?: Ambient;
  /** Which part of the image stays visible when the box is shorter than the art: 0 top, 1 bottom. Default 0.65 (keeps the floor). */
  focusY?: number;
  className?: string;
  style?: CSSProperties;
  /** Drawn above the backdrop and the particles. */
  children?: ReactNode;
}

interface Placement {
  scale: number;
  left: number;
  top: number;
}

/**
 * Full-bleed backdrop that fills its container. Uses sceneries/<id> when the art exists, otherwise a procedural
 * pixel backdrop from the palette. The art is scaled by a whole number (cover) and placed on whole pixels.
 */
export function Scenery({ scenery, ambient = scenery.ambient ?? 'none', focusY = 0.65, className, style, children }: SceneryProps) {
  const container = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | undefined>();
  const [failed, setFailed] = useState<string[]>([]);

  const key = scenery.asset ?? `sceneries/${scenery.id}`;
  const real = !failed.includes(key) ? ASSETS[key] : undefined;
  const width = real?.w ?? SCENERY_SIZE.w;
  const height = real?.h ?? SCENERY_SIZE.h;

  const { sky, horizon, floor } = scenery.palette;
  const paths = useMemo(
    () => (real ? [] : drawProceduralScenery(scenery.id, { sky, horizon, floor })),
    [real, scenery.id, sky, horizon, floor],
  );

  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    const place = () => {
      const { clientWidth, clientHeight } = node;
      const scale = Math.max(1, Math.ceil(Math.max(clientWidth / width, clientHeight / height)));
      setPlacement({
        scale,
        left: Math.round((clientWidth - width * scale) / 2),
        top: Math.round((clientHeight - height * scale) * Math.min(1, Math.max(0, focusY))),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height, focusY]);

  const scale = placement?.scale ?? 2;
  return (
    <div ref={container} className={className ? `scenery ${className}` : 'scenery'} style={style} data-scenery={scenery.id}>
      <svg
        className="scenery-backdrop"
        data-placed={placement !== undefined}
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
        style={placement ? { left: placement.left, top: placement.top } : undefined}
        aria-hidden="true"
      >
        {real ? (
          <image href={`/assets/${key}.png`} width={width} height={height} onError={() => setFailed((previous) => [...previous, key])} />
        ) : (
          <PixelPaths paths={paths} />
        )}
      </svg>
      <AmbientParticles ambient={ambient} seed={scenery.id} pixel={scale} />
      <div className="scenery-content">{children}</div>
    </div>
  );
}
