'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { themeVariables } from '@/ui/ThemeProvider';

interface SceneOverlayProps {
  /** Accessible name of the scene. */
  label: string;
  onClose: () => void;
  /** Colour of the burst behind the scene. Defaults to the HUD accent. */
  accent?: string;
  variant?: 'hire' | 'unlock' | 'legendary' | 'graduate';
  children: ReactNode;
}

/**
 * A full-screen scene that waits for the player. It sits below the toasts and the effects layer, so confetti
 * and notifications stay visible on top. Focus moves into it and Esc closes it.
 */
export function SceneOverlay({ label, onClose, accent, variant = 'unlock', children }: SceneOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = root.current;
    node?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const buttons = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  // Re-tint the scene: --accent and --on-accent drive the kit buttons inside it.
  const style = { ...themeVariables(undefined, accent), '--scene': 'var(--accent)' };
  return (
    <div ref={root} className="scene" data-variant={variant} role="dialog" aria-modal="true" aria-labelledby={titleId} style={style}>
      <div className="scene-rays" aria-hidden="true" />
      <div className="scene-content">
        <h2 id={titleId} className="sr-only">
          {label}
        </h2>
        {children}
      </div>
    </div>
  );
}
