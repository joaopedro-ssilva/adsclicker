'use client';
import type { ReactNode } from 'react';
import { Button } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { Window } from '../screen/Window';

interface NoticeViewProps {
  emoji: string;
  title: string;
  text: string;
  /** Icon of the window header. */
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  children?: ReactNode;
}

/** A window in the middle of the screen for states without a fight: offline, locked, loading. */
export function NoticeView({ emoji, title, text, icon, actionLabel, onAction, busy = false, children }: NoticeViewProps) {
  return (
    <div className="ar-frame" data-width="sm" role="status">
      <Window title="Hackathon" icon={icon} size="md">
        <div className="ar-notice">
          <span className="ar-notice-emoji" aria-hidden="true">
            {emoji}
          </span>
          <h2 className="ar-notice-title">{title}</h2>
          <p className="ar-notice-text">{text}</p>
          {children}
          {actionLabel && onAction ? (
            <Button variant="primary" onClick={onAction} disabled={busy}>
              {busy ? 'Tentando...' : actionLabel}
            </Button>
          ) : null}
        </div>
      </Window>
    </div>
  );
}
