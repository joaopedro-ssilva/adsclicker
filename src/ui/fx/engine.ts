import { fitCanvas } from '../fitCanvas';
import type { BurstOptions, CoinBurstOptions, FloatingNumberOptions, FxHandle, Point, ShakeOptions } from './types';

const MAX_PARTICLES = 700;
const MAX_TEXTS = 40;
const MAX_BURST = 300;
const ART_PIXEL = 3;
const CONFETTI_COLORS = ['#ee8aa0', '#f2d56b', '#7fb6f0', '#8fe0a8', '#c79bf2', '#ffffff'];
const GOLD = '#f6c244';
const GOLD_DARK = '#b8791f';

interface Timed {
  born: number;
  life: number;
}

interface CoinParticle extends Timed {
  kind: 'coin';
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  homeX: number;
  homeY: number;
  homing: boolean;
  curve: number;
  target: HTMLElement;
  burst: CoinBurst;
}

interface SparkParticle extends Timed {
  kind: 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

interface ConfettiParticle extends Timed {
  kind: 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  flip: number;
}

interface TextParticle extends Timed {
  kind: 'text';
  x: number;
  y: number;
  vy: number;
  text: string;
  size: number;
  color: string;
  crit: boolean;
}

type Particle = CoinParticle | SparkParticle | ConfettiParticle | TextParticle;

interface CoinBurst {
  remaining: number;
  onArrive?: () => void;
}

const noise = (spread: number) => (Math.random() * 2 - 1) * spread;
const easeIn = (t: number) => t * t * t;

/** The canvas side of the FxLayer: particles, the animation loop and screen shake. No React in here. */
export class FxEngine implements FxHandle {
  private particles: Particle[] = [];
  private frame = 0;
  private last = 0;
  private width = 1;
  private height = 1;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fontFamily: string;
  private readonly accent: () => string;
  private readonly stopFit: () => void;
  private readonly shakes = new Map<HTMLElement, Animation>();
  private readonly pops = new Map<HTMLElement, number>();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly reduced: boolean,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    const style = getComputedStyle(canvas);
    this.fontFamily = style.getPropertyValue('--font-pixel').trim() || 'monospace';
    this.accent = () => getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#e5484d';
    void document.fonts?.load(`700 20px ${this.fontFamily}`).catch(() => undefined);
    this.stopFit = fitCanvas(canvas, ({ width, height, dpr }) => {
      this.width = width;
      this.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      this.draw(performance.now(), 0);
    });
  }

  floatingNumber = (options: FloatingNumberOptions): void => {
    if (this.particles.length >= MAX_PARTICLES || this.particles.filter((particle) => particle.kind === 'text').length >= MAX_TEXTS) return;
    const crit = options.crit === true;
    this.particles.push({
      kind: 'text',
      x: options.x,
      y: options.y,
      vy: this.reduced ? 0 : -70,
      text: options.thumbsUp ? `${options.text} 👍` : options.text,
      size: crit ? 30 : 20,
      color: options.color ?? (crit ? '#ffd57d' : '#ffffff'),
      crit,
      born: performance.now(),
      life: this.reduced ? 700 : crit ? 1400 : 950,
    });
    this.start();
  };

  coins = (options: CoinBurstOptions): void => {
    const count = this.count(options.count, 18);
    if (this.reduced) {
      options.onArrive?.();
      return;
    }
    const burst: CoinBurst = { remaining: count, onArrive: options.onArrive };
    const now = performance.now();
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 190;
      this.particles.push({
        kind: 'coin',
        x: options.x,
        y: options.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        spin: Math.random() * 6,
        homeX: 0,
        homeY: 0,
        homing: false,
        curve: noise(70),
        target: options.target,
        burst,
        born: now + i * 14,
        life: 1000 + Math.random() * 350,
      });
    }
    this.start();
  };

  sparkles = (options: BurstOptions): void => {
    if (this.reduced) return;
    const color = options.color ?? this.accent();
    this.spawnSparks(options, this.count(options.count, 55), () => color, 40, 240, 1);
  };

  confetti = (options: BurstOptions): void => {
    if (this.reduced) return;
    const count = this.count(options.count, 90);
    const now = performance.now();
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i += 1) {
      const angle = -Math.PI / 2 + noise(Math.PI * 0.45);
      const speed = 140 + Math.random() * 420;
      this.particles.push({
        kind: 'confetti',
        x: options.x,
        y: options.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.floor(Math.random() * 2),
        color: options.color ?? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? '#ffffff',
        flip: Math.random() * 8,
        born: now + i,
        life: 1400 + Math.random() * 900,
      });
    }
    this.start();
  };

  shake = ({ target, intensity = 6, duration = 320 }: ShakeOptions = {}): void => {
    const element = target ?? document.querySelector<HTMLElement>('[data-shake-root]') ?? document.querySelector<HTMLElement>('main');
    if (this.reduced || !element) return;
    this.shakes.get(element)?.cancel();
    const peak = Math.min(16, Math.max(0, intensity));
    const steps = 9;
    const keyframes: Keyframe[] = Array.from({ length: steps }, (_, index) => {
      const power = peak * (1 - index / steps);
      return {
        transform: `translate(${Math.round(noise(power))}px, ${Math.round(noise(power * 0.6))}px)`,
        easing: 'steps(1, end)',
      };
    });
    keyframes.push({ transform: 'translate(0, 0)' });
    const animation = element.animate(keyframes, { duration });
    this.shakes.set(element, animation);
    animation.onfinish = () => {
      if (this.shakes.get(element) === animation) this.shakes.delete(element);
    };
  };

  clear = (): void => {
    this.particles = [];
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.shakes.forEach((animation) => animation.cancel());
    this.shakes.clear();
  };

  destroy(): void {
    this.clear();
    this.stopFit();
    this.pops.clear();
  }

  private count(requested: number | undefined, fallback: number): number {
    return Math.max(1, Math.min(MAX_BURST, Math.floor(requested ?? fallback)));
  }

  private spawnSparks(origin: Point, count: number, color: () => string, minSpeed: number, maxSpeed: number, lift: number): void {
    const now = performance.now();
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      this.particles.push({
        kind: 'spark',
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30 * lift,
        size: 1 + Math.floor(Math.random() * 3),
        color: color(),
        born: now + i * 2,
        life: 450 + Math.random() * 450,
      });
    }
    this.start();
  }

  /** The loop only runs while something is alive, so an idle game costs nothing. */
  private start(): void {
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.draw(now, dt);
    if (this.particles.length > 0) this.frame = requestAnimationFrame(this.tick);
  };

  private popTarget(target: HTMLElement): void {
    const now = performance.now();
    if (now - (this.pops.get(target) ?? 0) < 90) return;
    this.pops.set(target, now);
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }],
      { duration: 160, easing: 'steps(3, end)' },
    );
  }

  private draw(now: number, dt: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const centers = new Map<HTMLElement, Point>();
    const texts: TextParticle[] = [];
    let alive = 0;

    for (const particle of this.particles) {
      const age = (now - particle.born) / particle.life;
      if (age >= 1) {
        if (particle.kind === 'coin') this.landCoin(particle);
        continue;
      }
      this.particles[alive++] = particle;
      if (age < 0) continue;

      if (particle.kind === 'text') {
        particle.y += particle.vy * dt;
        particle.vy *= 0.96 ** (dt * 60);
        texts.push(particle);
      } else if (particle.kind === 'coin') {
        this.drawCoin(particle, age, dt, centers);
      } else if (particle.kind === 'spark') {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.93 ** (dt * 60);
        particle.vy *= 0.93 ** (dt * 60);
        this.drawSpark(particle, age);
      } else {
        particle.vy += 520 * dt;
        particle.vx *= 0.985 ** (dt * 60);
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        this.drawConfetti(particle, age);
      }
    }
    this.particles.length = alive;
    ctx.globalAlpha = 1;
    for (const text of texts) this.drawText(text, (now - text.born) / text.life);
  }

  private drawCoin(coin: CoinParticle, age: number, dt: number, centers: Map<HTMLElement, Point>): void {
    const burstEnd = 0.32;
    if (age < burstEnd) {
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      coin.vx *= 0.9 ** (dt * 60);
      coin.vy = coin.vy * 0.9 ** (dt * 60) + 380 * dt;
    } else {
      if (!coin.homing) {
        coin.homing = true;
        coin.homeX = coin.x;
        coin.homeY = coin.y;
      }
      let center = centers.get(coin.target);
      if (!center) {
        const rect = coin.target.getBoundingClientRect();
        center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        centers.set(coin.target, center);
      }
      const t = easeIn((age - burstEnd) / (1 - burstEnd));
      coin.x = coin.homeX + (center.x - coin.homeX) * t + Math.sin(t * Math.PI) * coin.curve;
      coin.y = coin.homeY + (center.y - coin.homeY) * t;
    }

    const { ctx } = this;
    const unit = ART_PIXEL;
    const x = Math.round(coin.x / unit) * unit;
    const y = Math.round(coin.y / unit) * unit;
    const wide = Math.abs(Math.cos(age * 14 + coin.spin)) > 0.5;
    ctx.globalAlpha = 1;
    ctx.fillStyle = GOLD_DARK;
    if (wide) {
      ctx.fillRect(x - 3 * unit, y - 2 * unit, 6 * unit, 4 * unit);
      ctx.fillRect(x - 2 * unit, y - 3 * unit, 4 * unit, 6 * unit);
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - 2 * unit, y - 2 * unit, 4 * unit, 4 * unit);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(x - 2 * unit, y - 2 * unit, unit, 2 * unit);
    } else {
      ctx.fillRect(x - unit, y - 3 * unit, 2 * unit, 6 * unit);
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - unit, y - 2 * unit, unit, 4 * unit);
    }
  }

  private landCoin(coin: CoinParticle): void {
    this.popTarget(coin.target);
    const rect = coin.target.getBoundingClientRect();
    if (Math.random() < 0.35) {
      this.spawnSparks({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, 2, () => '#fff3b0', 30, 90, 0);
    }
    coin.burst.remaining -= 1;
    if (coin.burst.remaining === 0) coin.burst.onArrive?.();
  }

  private drawSpark(spark: SparkParticle, age: number): void {
    const { ctx } = this;
    const unit = ART_PIXEL;
    const x = Math.round(spark.x / unit) * unit;
    const y = Math.round(spark.y / unit) * unit;
    const arm = spark.size * unit;
    ctx.globalAlpha = Math.min(1, (1 - age) * 2.5);
    ctx.fillStyle = spark.color;
    ctx.fillRect(x - arm, y, arm * 2 + unit, unit);
    ctx.fillRect(x, y - arm, unit, arm * 2 + unit);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, unit, unit);
  }

  private drawConfetti(piece: ConfettiParticle, age: number): void {
    const { ctx } = this;
    const unit = ART_PIXEL;
    const flat = Math.floor(age * 14 + piece.flip) % 2 === 0;
    ctx.globalAlpha = Math.min(1, (1 - age) * 3);
    ctx.fillStyle = piece.color;
    ctx.fillRect(Math.round(piece.x / unit) * unit, Math.round(piece.y / unit) * unit, unit * (flat ? piece.size : 1), unit * (flat ? 1 : piece.size));
  }

  private drawText(text: TextParticle, age: number): void {
    const { ctx } = this;
    const pop = age < 0.1 ? 0.5 + (age / 0.1) * 0.95 : age < 0.18 ? 1.45 - ((age - 0.1) / 0.08) * 0.45 : 1;
    const shake = text.crit && !this.reduced ? Math.round(Math.sin(age * 90) * (1 - age) * 4) : 0;
    ctx.font = `${text.crit ? 700 : 400} ${text.size}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const half = ctx.measureText(text.text).width / 2 + 10;
    const x = Math.round(Math.min(this.width - half, Math.max(half, text.x)) + shake);
    const y = Math.round(text.y);
    ctx.globalAlpha = Math.min(1, (1 - age) * 3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.lineJoin = 'round';
    ctx.lineWidth = text.crit ? 7 : 5;
    ctx.strokeStyle = '#11131b';
    ctx.strokeText(text.text, 0, 0);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
