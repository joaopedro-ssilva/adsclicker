/** Where a roll landed inside its range, 0 to 100, in ten cells. Colour follows the thirds. */
export function QualityBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round(clamped / 10);
  const level = clamped >= 70 ? 'high' : clamped >= 35 ? 'mid' : 'low';
  return (
    <div className="hk-quality" role="img" aria-label={`${label}: ${Math.round(clamped)} de 100`} data-level={level}>
      {Array.from({ length: 10 }, (_, index) => (
        <i key={index} data-on={index < filled} />
      ))}
    </div>
  );
}
