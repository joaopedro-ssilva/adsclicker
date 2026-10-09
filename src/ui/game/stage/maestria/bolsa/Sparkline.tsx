interface SparklineProps {
  values: number[];
  /** The price band of the asset, so every sparkline of one asset has the same vertical scale. */
  lo: number;
  hi: number;
  label: string;
}

const WIDTH = 96;
const HEIGHT = 28;

/** A tiny price chart: one polyline over the band of the asset, with a line at 1.00 (the fair price). */
export function Sparkline({ values, lo, hi, label }: SparklineProps) {
  const span = Math.max(1e-6, hi - lo);
  const y = (value: number) => HEIGHT - 2 - ((Math.min(hi, Math.max(lo, value)) - lo) / span) * (HEIGHT - 4);
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const rising = values.length > 1 && (values[values.length - 1] ?? 0) >= (values[0] ?? 0);

  return (
    <svg
      className="sparkline"
      data-rising={rising}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <line className="sparkline-mid" x1={0} x2={WIDTH} y1={y(1)} y2={y(1)} />
      {values.length > 1 ? <polyline className="sparkline-line" points={points} fill="none" /> : null}
    </svg>
  );
}
