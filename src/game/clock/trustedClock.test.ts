import { describe, expect, it } from 'vitest';
import { CLOCK_SKEW_REPORT_MS, clockGuard, createClockGuard, trustedNow } from './trustedClock';
import type { ClockEnvironment } from './trustedClock';

/** The userscript pasted in the console by the player who cheated, verbatim. */
const SPEEDHACK = `
(() => {
  let speed = 2.0; let lastReal = performance.now(); let virtualTime = lastReal;
  const origPerfNow = performance.now.bind(performance);
  performance.now = () => { const now = origPerfNow(); virtualTime += (now - lastReal) * speed; lastReal = now; return virtualTime; };
  const origDateNow = Date.now.bind(Date); let dateBase = origDateNow(); let perfBase = origPerfNow();
  Date.now = () => dateBase + (performance.now() - perfBase);
  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => origRAF(() => cb(performance.now()));
  window.setGameSpeed = (s) => { performance.now(); speed = s; };
})();
`;

/** A browser as the userscript sees it: its own Date, performance and window, with the real (native) functions. */
function browser() {
  const env: ClockEnvironment & { window: { requestAnimationFrame: (cb: (t: number) => void) => number; setGameSpeed?: (s: number) => void } } = {
    Date: { now: Date.now.bind(Date) },
    performance: { now: performance.now.bind(performance) },
    window: { requestAnimationFrame: (cb) => (cb(0), 1) },
  };
  return env;
}

/** Pastes the userscript into that browser's console. */
function paste(env: ReturnType<typeof browser>): void {
  new Function('Date', 'performance', 'window', SPEEDHACK)(env.Date, env.performance, env.window);
}

const wait = (ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait: the test needs real time to pass
  }
};

describe('trusted clock', () => {
  it('reports nothing on an untouched browser', () => {
    expect(createClockGuard(browser()).report()).toBeNull();
    // (Not asserted on the real globals: Node's performance.now is JavaScript, only a browser's is native.)
    expect(typeof clockGuard.now()).toBe('number');
  });

  it('follows the real time, in epoch ms', () => {
    expect(Math.abs(trustedNow() - Date.now())).toBeLessThan(50);
  });

  it('keeps real time after the userscript is pasted, and reports the patch with the skew it causes', () => {
    const env = browser();
    const guard = createClockGuard(env); // the game loaded first
    paste(env);
    env.window.setGameSpeed?.(2000); // the cheat

    const before = guard.now();
    wait(20);
    const real = guard.now() - before;
    // The page's clock ran away; the guard's did not.
    expect(real).toBeGreaterThanOrEqual(15);
    expect(real).toBeLessThan(500);
    expect(env.Date.now() - guard.now()).toBeGreaterThan(CLOCK_SKEW_REPORT_MS);

    const report = guard.report();
    expect(report?.patched).toBe(true);
    expect(Math.abs(report?.skewMs ?? 0)).toBeGreaterThan(CLOCK_SKEW_REPORT_MS);
  });

  it('reports the patch even at speed 1, before any skew has grown', () => {
    const env = browser();
    const guard = createClockGuard(env);
    paste(env);
    expect(guard.report()).toMatchObject({ patched: true });
    expect(guard.report()?.skewMs).toBe(0);
  });

  it('a script that ran before the game is still reported (its functions are not native)', () => {
    const env = browser();
    paste(env);
    const late = createClockGuard(env);
    expect(late.report()).toMatchObject({ patched: true });
  });

  it('only one of the two functions patched is enough', () => {
    const env = browser();
    const guard = createClockGuard(env);
    env.Date.now = () => 0;
    expect(guard.report()?.patched).toBe(true);

    const other = browser();
    const guard2 = createClockGuard(other);
    if (other.performance) other.performance.now = () => 0;
    expect(guard2.report()?.patched).toBe(true);
  });

  it('a patched function that throws does not break the report', () => {
    const env = browser();
    const guard = createClockGuard(env);
    env.Date.now = () => {
      throw new Error('boom');
    };
    expect(guard.report()).toMatchObject({ patched: true });
  });

  it('browsers without performance.now are fine', () => {
    const guard = createClockGuard({ Date: { now: Date.now.bind(Date) } });
    expect(guard.report()).toBeNull();
    expect(typeof guard.perfNow()).toBe('number');
  });

  it('a native bound function (what the guard keeps) and a built-in count as native; an arrow does not', () => {
    const env = browser();
    env.Date.now = Math.max as unknown as () => number; // a built-in: native
    expect(createClockGuard(env).report()).toBeNull();
    env.Date.now = () => 1;
    expect(createClockGuard(env).report()).toMatchObject({ patched: true });
  });
});
