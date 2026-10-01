/** A point in CSS pixels relative to the viewport, like MouseEvent.clientX / clientY. */
export interface Point {
  x: number;
  y: number;
}

export interface FloatingNumberOptions extends Point {
  /** Already formatted, for example "+12,5 K". */
  text: string;
  /** Bigger, gold, shaking. */
  crit?: boolean;
  /** Appends the 👍 of the original game. */
  thumbsUp?: boolean;
  color?: string;
}

export interface BurstOptions extends Point {
  /** Particles to spawn (capped at 300). Defaults: 18 coins, 55 sparkles, 90 confetti. */
  count?: number;
  /** One colour for every particle. Omit for the default palette (accent for sparkles, party colours for confetti). */
  color?: string;
}

export interface CoinBurstOptions extends BurstOptions {
  /** The coins burst outwards, then fly to the centre of this element, which pops when they land. */
  target: HTMLElement;
  /** Called once when the last coin lands (for example to add the coins to the counter). */
  onArrive?: () => void;
}

export interface ShakeOptions {
  /** Element to shake. Default: the element marked data-shake-root, otherwise <main>. */
  target?: HTMLElement;
  /** Peak displacement in px. Default 6, max 16. */
  intensity?: number;
  /** Milliseconds. Default 320. */
  duration?: number;
}

export interface FxHandle {
  floatingNumber: (options: FloatingNumberOptions) => void;
  coins: (options: CoinBurstOptions) => void;
  sparkles: (options: BurstOptions) => void;
  confetti: (options: BurstOptions) => void;
  shake: (options?: ShakeOptions) => void;
  /** Removes every particle and cancels running shakes. */
  clear: () => void;
}
