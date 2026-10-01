import { useState } from 'react';

/**
 * Counts how many times `value` changed since mount (the first render does not count). Use the count as a
 * React key to replay a CSS "pop" animation on change, without effects or refs.
 */
export function useChangeCount(value: unknown): number {
  const [previous, setPrevious] = useState(value);
  const [count, setCount] = useState(0);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    setCount(count + 1);
  }
  return count;
}
