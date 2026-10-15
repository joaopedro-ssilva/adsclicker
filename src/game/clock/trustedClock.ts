/**
 * The clock the game reads, kept out of reach of a script pasted in the console (docs/BACKEND.md,
 * "Relógio do jogo"). A speedhack replaces `Date.now` / `performance.now` with functions that run
 * fast; the game then believes more time passed and pays production, buffs and offline gain for it.
 *
 * Two cheap defences, neither of them a lock (the client can always be patched, so the server's check
 * of the save against its own clock is the one that counts):
 *
 *  1. References to the browser's own `Date.now` and `performance.now` are taken when this module is
 *     evaluated, before anything typed in the console can run. A patch applied afterwards replaces
 *     the property, not the function the game already holds, so the game keeps real time.
 *  2. The page's current `Date.now` / `performance.now` are checked: if either is no longer a native
 *     function (`Function.prototype.toString` without "[native code]"), or the page clock has drifted
 *     from the real one, the sync reports it and the server keeps a trail.
 *
 * It does not stop a script that runs before the game (a userscript manager at document-start): the
 * references taken here would already be the patched ones. The native check still reports that case
 * unless the script also fakes `toString`, and the server's clock check catches the effect either way.
 */

/** The slice of the browser the guard reads; the real globals by default, a fake in tests. */
export interface ClockEnvironment {
  Date: { now: () => number };
  performance?: { now: () => number };
}

/** What the sync tells the server (shared/api.ts `clock`). */
export interface ClockReport {
  /** `Date.now` or `performance.now` is not the browser's own function. */
  patched: boolean;
  /** The page's `Date.now()` minus the real one, in ms; 0 while they agree to within a second. */
  skewMs: number;
}

export interface ClockGuard {
  /** Epoch ms from the browser's own clock, whatever the page did to `Date.now` since. */
  now: () => number;
  /** Monotonic ms from the browser's own clock. */
  perfNow: () => number;
  /** What looks wrong with the page's clock right now, or null when nothing does. */
  report: () => ClockReport | null;
}

/** A page clock this far from the real one (ms) counts as skewed; two calls a few ms apart never get there. */
export const CLOCK_SKEW_REPORT_MS = 1_000;

export function createClockGuard(env: ClockEnvironment, toStringOf: (fn: unknown) => string = nativeToString): ClockGuard {
  const isNative = (fn: unknown): boolean => typeof fn === 'function' && toStringOf(fn).includes('[native code]');

  // Taken now, once. Bound, so a later `Date.now = ...` cannot reach them and they need no `this`.
  const realNow = env.Date.now.bind(env.Date);
  const realPerf = env.performance ? env.performance.now.bind(env.performance) : null;
  const patchedAtLoad = !isNative(env.Date.now) || (env.performance !== undefined && !isNative(env.performance.now));

  const skewOf = (visible: () => number, real: () => number): number => {
    try {
      const skew = Math.round(visible() - real());
      return Number.isFinite(skew) && Math.abs(skew) >= CLOCK_SKEW_REPORT_MS ? skew : 0;
    } catch {
      return 0; // a patched function that throws is reported as patched below
    }
  };

  return {
    now: realNow,
    perfNow: realPerf ?? (() => realNow()),
    report() {
      const patched = patchedAtLoad || !isNative(env.Date.now) || (env.performance !== undefined && !isNative(env.performance.now));
      const dateSkew = skewOf(() => env.Date.now(), realNow);
      const perfSkew = env.performance && realPerf ? skewOf(() => env.performance!.now(), realPerf) : 0;
      const skewMs = Math.abs(dateSkew) >= Math.abs(perfSkew) ? dateSkew : perfSkew;
      return patched || skewMs !== 0 ? { patched, skewMs } : null;
    },
  };
}

/** `Function.prototype.toString` as it was when this module loaded, so a later replacement cannot lie. */
const pristineToString = typeof Function === 'function' ? Function.prototype.toString : null;

function nativeToString(fn: unknown): string {
  try {
    return pristineToString ? pristineToString.call(fn) : '';
  } catch {
    return '';
  }
}

/** The guard of this page. Its references are the ones taken when the module first loads. */
export const clockGuard: ClockGuard = createClockGuard({
  Date,
  performance: typeof performance === 'undefined' ? undefined : performance,
});

/** Epoch ms for the game loop and the cloud: the browser's own clock, not whatever `Date.now` is now. */
export const trustedNow = clockGuard.now;
