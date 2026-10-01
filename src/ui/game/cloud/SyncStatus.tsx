'use client';
import { useCloud } from '@/game/cloud';
import { Icon } from '@/ui/kit';
import { syncStatusView } from './syncStatusText';
import { useNow } from './useNow';

/** One quiet line about the cloud: an icon and a short sentence that follows the sync. */
export function SyncStatus() {
  const status = useCloud((store) => store.status);
  const unavailable = useCloud((store) => store.unavailable);
  const lastSyncedAt = useCloud((store) => store.lastSyncedAt);
  const now = useNow(1000);
  const view = syncStatusView({ status, unavailable, lastSyncedAt, now });

  return (
    <p className="sync-status" data-tone={view.tone} data-status={status} role="status" data-qa="sync-status">
      <Icon name="cloud" size={16} />
      <span>{view.text}</span>
    </p>
  );
}
