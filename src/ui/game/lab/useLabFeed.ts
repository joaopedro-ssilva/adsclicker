import { useEffect, useRef, useState } from 'react';
import { content, useGameEvents } from '@/game/store';
import { FEED_EVENTS, feedText } from './labFormat';

const FEED_MS = 2600;

export interface LabFeedMessage {
  id: number;
  text: string;
}

/** The last thing that happened in the run (phase cleared, item found, item changed), for a few seconds. */
export function useLabFeed(): LabFeedMessage | null {
  const [message, setMessage] = useState<LabFeedMessage | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useGameEvents((event) => {
    const text = feedText(content, event);
    if (!text) return;
    seq.current += 1;
    setMessage({ id: seq.current, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), FEED_MS);
  }, FEED_EVENTS);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return message;
}
