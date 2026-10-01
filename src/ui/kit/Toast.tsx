'use client';
import { useSyncExternalStore } from 'react';
import { IconButton } from './IconButton';
import { Icon, type IconName } from './icons';
import { toast, toastStore, type ToastOptions } from './toastStore';

const TONE_ICON: Record<NonNullable<ToastOptions['tone']>, IconName> = {
  good: 'check',
  warn: 'clock',
  bad: 'x',
  neutral: 'star',
};

/** Mount once near the root. Fires from anywhere with toast(). */
export function ToastStack() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot);

  return (
    <div className="ui-toast-stack" role="region" aria-label="Notificações" aria-live="polite" aria-relevant="additions">
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        return (
          <div className="ui-toast pixel-frame" key={item.id} data-tone={tone}>
            {item.emoji ? (
              <span className="ui-toast-emoji" aria-hidden="true">
                {item.emoji}
              </span>
            ) : (
              <Icon name={TONE_ICON[tone]} className="ui-toast-icon" />
            )}
            <div className="ui-toast-body">
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
            </div>
            <IconButton icon="x" label="Dispensar notificação" size="sm" variant="ghost" onClick={() => toast.dismiss(item.id)} />
          </div>
        );
      })}
    </div>
  );
}
