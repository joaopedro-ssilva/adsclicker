'use client';
import type { ReactNode } from 'react';
import { Button } from '@/ui/kit';

interface NoticeViewProps {
  emoji: string;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  children?: ReactNode;
}

/** A card in the middle of the arena for states without a fight: offline, locked, loading. */
export function NoticeView({ emoji, title, text, actionLabel, onAction, busy = false, children }: NoticeViewProps) {
  return (
    <div className="ar-center">
      <div className="ar-notice" role="status">
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
    </div>
  );
}
