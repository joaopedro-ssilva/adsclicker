'use client';
import { useEffect, useRef } from 'react';
import type { Ambient } from '@/game/content/types';
import { fitCanvas } from '../fitCanvas';
import { useReducedMotion } from '../useReducedMotion';
import { seededRandom } from './procedural';

export interface AmbientParticlesProps {
  ambient: Ambient;
  seed?: string;
  /** Size of one "art pixel" in CSS px. Pass the scenery scale so particles share its pixel grid. Default 3. */
  pixel?: number;
}

type Moving = Exclude<Ambient, 'none'>;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  tint: number;
}

interface Profile {
  /** Particles per 100,000 CSS px of canvas area. */
  density: number;
  /** Speeds are in art pixels per second. */
  speed: [number, number];
  /** +1 falls, -1 rises, 0 stays. */
  direction: 1 | -1 | 0;
  sway: number;
}

const PROFILES: Record<Moving, Profile> = {
  dust: { density: 9, speed: [1.5, 5], direction: -1, sway: 3 },
  rain: { density: 22, speed: [120, 190], direction: 1, sway: 0 },
  embers: { density: 12, speed: [9, 24], direction: -1, sway: 6 },
  stars: { density: 14, speed: [0, 0], direction: 0, sway: 0 },
  bubbles: { density: 7, speed: [8, 16], direction: -1, sway: 4 },
  code: { density: 8, speed: [14, 34], direction: 1, sway: 0 },
  leaves: { density: 7, speed: [10, 20], direction: 1, sway: 9 },
  confetti: { density: 14, speed: [22, 44], direction: 1, sway: 7 },
};

const EMBER_COLORS = ['#ff8a4c', '#ffd27a', '#ff5a36'];
const LEAF_COLORS = ['#a8c46a', '#e8a8b4', '#7fae5c', '#f4c6d0'];
const CONFETTI_COLORS = ['#ee8aa0', '#f2d56b', '#7fb6f0', '#8fe0a8', '#c79bf2'];
const FRAME_MS = 33;

function spawn(profile: Profile, random: () => number, width: number, height: number, pixel: number, anywhere: boolean): Particle {
  const speed = (profile.speed[0] + random() * (profile.speed[1] - profile.speed[0])) * pixel;
  const edge = profile.direction > 0 ? -pixel * 6 : height + pixel * 6;
  return {
    x: random() * width,
    y: anywhere || profile.direction === 0 ? random() * height : edge,
    vx: 0,
    vy: speed * profile.direction,
    phase: random() * Math.PI * 2,
    size: 1 + Math.floor(random() * 3),
    tint: Math.floor(random() * 16),
  };
}

function snap(value: number, pixel: number): number {
  return Math.round(value / pixel) * pixel;
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  ambient: Moving,
  p: Particle,
  time: number,
  pixel: number,
  width: number,
  fontFamily: string,
): void {
  const sway = PROFILES[ambient].sway;
  const x = snap(p.x + Math.sin(time * 1.4 + p.phase) * sway * pixel, pixel);
  const y = snap(p.y, pixel);
  if (x < -pixel * 8 || x > width + pixel * 8) return;

  switch (ambient) {
    case 'dust':
      ctx.globalAlpha = 0.25 + 0.3 * ((p.tint % 4) / 3);
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(x, y, pixel * (p.size > 2 ? 2 : 1), pixel);
      break;
    case 'rain':
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#a9c8ff';
      ctx.fillRect(x, y, pixel, pixel * (3 + p.size));
      break;
    case 'embers':
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 5 + p.phase));
      ctx.fillStyle = EMBER_COLORS[p.tint % EMBER_COLORS.length] ?? '#ff8a4c';
      ctx.fillRect(x, y, pixel * (p.size > 2 ? 2 : 1), pixel * (p.size > 2 ? 2 : 1));
      break;
    case 'stars': {
      const twinkle = 0.3 + 0.7 * ((Math.sin(time * 2.2 + p.phase) + 1) / 2);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = p.tint % 5 === 0 ? '#ffe9a8' : '#ffffff';
      ctx.fillRect(x, y, pixel, pixel);
      if (p.size === 3 && twinkle > 0.7) {
        ctx.fillRect(x - pixel, y, pixel * 3, pixel);
        ctx.fillRect(x, y - pixel, pixel, pixel * 3);
      }
      break;
    }
    case 'bubbles': {
      const side = pixel * (2 + p.size);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#d6f4ff';
      ctx.fillRect(x, y, side, pixel);
      ctx.fillRect(x, y + side - pixel, side, pixel);
      ctx.fillRect(x, y, pixel, side);
      ctx.fillRect(x + side - pixel, y, pixel, side);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x + pixel, y + pixel, pixel, pixel);
      break;
    }
    case 'code':
      ctx.globalAlpha = 0.25 + 0.5 * ((p.tint % 4) / 3);
      ctx.fillStyle = '#7dffb4';
      ctx.font = `${pixel * 5}px ${fontFamily}`;
      ctx.fillText(p.tint % 3 === 0 ? '1' : p.tint % 3 === 1 ? '0' : '{}', x, y);
      break;
    case 'leaves': {
      const color = LEAF_COLORS[p.tint % LEAF_COLORS.length] ?? '#a8c46a';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pixel * 3, pixel * 2);
      ctx.fillRect(x + pixel * (Math.floor(time * 3 + p.phase) % 2), y - pixel, pixel * 2, pixel);
      break;
    }
    case 'confetti': {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = CONFETTI_COLORS[p.tint % CONFETTI_COLORS.length] ?? '#ee8aa0';
      const flat = Math.floor(time * 6 + p.phase) % 2 === 0;
      ctx.fillRect(x, y, pixel * (flat ? 3 : 1), pixel * (flat ? 1 : 3));
      break;
    }
  }
}

/** Decorative moving particles on a canvas that fills its parent. Pauses off screen and in hidden tabs. */
export function AmbientParticles({ ambient, seed = ambient, pixel = 3 }: AmbientParticlesProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx || ambient === 'none') return;

    const profile = PROFILES[ambient];
    const random = seededRandom(seed);
    const fontFamily = getComputedStyle(node).getPropertyValue('--font-pixel').trim() || 'monospace';
    let particles: Particle[] = [];
    let width = 1;
    let height = 1;
    let time = 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = 'top';
      for (const particle of particles) drawParticle(ctx, ambient, particle, time, pixel, width, fontFamily);
      ctx.globalAlpha = 1;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      time += dt;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) continue;
        particle.y += particle.vy * dt;
        particle.x += particle.vx * dt + (ambient === 'rain' ? -particle.vy * 0.18 * dt : 0);
        const gone = profile.direction > 0 ? particle.y > height + pixel * 8 : profile.direction < 0 ? particle.y < -pixel * 8 : false;
        if (gone || particle.x < -pixel * 10) particles[i] = spawn(profile, random, width, height, pixel, false);
        else if (particle.x > width + pixel * 10) particle.x = -pixel * 6;
      }
    };

    const shouldRun = () => visible && !document.hidden && !reduced;

    const tick = (now: number) => {
      frame = 0;
      if (now - last >= FRAME_MS) {
        step(now);
        render();
      }
      if (shouldRun()) frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (shouldRun() && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!shouldRun() && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const stopFit = fitCanvas(node, (fit) => {
      width = fit.width;
      height = fit.height;
      ctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const count = Math.min(140, Math.max(8, Math.round((width * height * profile.density) / 100000)));
      particles = Array.from({ length: count }, () => spawn(profile, random, width, height, pixel, true));
      render();
    });

    const intersection = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1]?.isIntersecting ?? false;
      sync();
    });
    intersection.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      stopFit();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ambient, seed, pixel, reduced]);

  if (ambient === 'none') return null;
  return <canvas ref={canvas} className="ambient-canvas" aria-hidden="true" />;
}
