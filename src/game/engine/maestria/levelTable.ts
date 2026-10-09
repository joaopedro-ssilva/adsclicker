/** Value of `levels[level - 1]`, clamped to the table (0 for an empty one). */
export const atLevel = (values: readonly number[], level: number): number =>
  values[Math.min(values.length, Math.max(1, level)) - 1] ?? 0;
