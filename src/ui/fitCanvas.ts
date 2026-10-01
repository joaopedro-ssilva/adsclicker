export interface CanvasFit {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio actually used (capped at 2 to keep fill-rate sane). */
  dpr: number;
}

/**
 * Keeps a canvas backing store matched to its CSS size and the device pixel ratio, including when
 * the ratio changes (browser zoom, moving between monitors). Resizing clears the canvas and resets
 * the context transform, so redraw and call setTransform(dpr, 0, 0, dpr, 0, 0) inside onFit.
 * Returns the cleanup function.
 */
export function fitCanvas(canvas: HTMLCanvasElement, onFit: (fit: CanvasFit) => void): () => void {
  let resolution: MediaQueryList | undefined;

  const apply = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    onFit({ width: rect.width, height: rect.height, dpr });
  };

  const onRatioChange = () => {
    apply();
    watchRatio();
  };

  function watchRatio() {
    resolution?.removeEventListener('change', onRatioChange);
    resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    resolution.addEventListener('change', onRatioChange);
  }

  const observer = new ResizeObserver(apply);
  observer.observe(canvas);
  watchRatio();
  apply();

  return () => {
    observer.disconnect();
    resolution?.removeEventListener('change', onRatioChange);
  };
}
