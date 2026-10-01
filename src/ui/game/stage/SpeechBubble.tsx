'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { content, useGameEvents, useGameState } from '@/game/store';

const SHOW_MS = 3800;
const CLICK_GAP_MS = 4500;
const CLICK_CHANCE = 0.22;
const IDLE_MIN_MS = 14_000;
const IDLE_MAX_MS = 24_000;

interface Line {
  professor: string;
  text: string;
  key: number;
}

function pick(lines: readonly string[], avoid?: string): string | undefined {
  const options = lines.length > 1 ? lines.filter((line) => line !== avoid) : lines;
  return options[Math.floor(Math.random() * options.length)];
}

const nextIdleDelay = () => IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);

/**
 * What the professor on stage says: a click line now and then while clicking, a milestone line on
 * milestones, an idle line when the player goes quiet. Lines come from ProfessorDef.quotes.
 */
export function SpeechBubble() {
  const professorId = useGameState((state) => state.activeProfessor);
  const quotes = content.professors[professorId].quotes;
  const [line, setLine] = useState<Line | null>(null);
  const sequence = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSpoke = useRef(0);
  const lastActivity = useRef(0);
  const idleAt = useRef(IDLE_MIN_MS);
  const lastText = useRef<string | undefined>(undefined);

  const say = useCallback(
    (text: string | undefined) => {
      if (!text) return;
      lastText.current = text;
      lastSpoke.current = performance.now();
      lastActivity.current = performance.now();
      idleAt.current = nextIdleDelay();
      sequence.current += 1;
      setLine({ professor: professorId, text, key: sequence.current });
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setLine(null), SHOW_MS);
    },
    [professorId],
  );

  useGameEvents((event) => {
    const now = performance.now();
    if (event.type === 'click') {
      if (event.auto) return;
      lastActivity.current = now;
      if (now - lastSpoke.current > CLICK_GAP_MS && Math.random() < CLICK_CHANCE) say(pick(quotes.click, lastText.current));
    } else if (event.type === 'milestone') {
      say(pick(quotes.milestone, lastText.current));
    }
  }, ['click', 'milestone']);

  useEffect(() => {
    lastActivity.current = performance.now();
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (performance.now() - lastActivity.current > idleAt.current) say(pick(quotes.idle, lastText.current));
    }, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(hideTimer.current);
    };
  }, [quotes, say]);

  if (!line || line.professor !== professorId) return null;
  return (
    <div className="speech" key={line.key} role="status" aria-live="off">
      <p>{line.text}</p>
    </div>
  );
}
