import { useEffect, useState, type RefObject } from 'react';

/** Whether the element is at least `minWidth` wide, following resizes. False until measured. */
export function useSplitLayout(ref: RefObject<HTMLElement | null>, minWidth: number): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= minWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minWidth]);
  return wide;
}
