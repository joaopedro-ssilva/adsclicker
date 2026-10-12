'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminTag, ApiErrorCode } from '@/shared/api';
import { api } from '@/shared/apiClient';
import type { BadgeTag } from '@/ui/game/panel/comunidade/TagBadge';

export interface AdminTagsState {
  /** The catalogue, highest priority first; null until the first answer. */
  tags: AdminTag[] | null;
  error: { code: ApiErrorCode; message: string } | null;
  reload: () => void;
  /** The tags among a player's ids, as badges (deleted ids are dropped). */
  badgesOf: (ids: readonly string[]) => BadgeTag[];
}

/** The tag catalogue of /admin. Reloaded after every change that moves a holder count. */
export function useAdminTags(): AdminTagsState {
  const [tags, setTags] = useState<AdminTag[] | null>(null);
  const [error, setError] = useState<AdminTagsState['error']>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    void api.admin.tags().then((result) => {
      if (!current) return;
      if (result.ok) setTags(result.data.tags);
      setError(result.ok ? null : result.error);
    });
    return () => {
      current = false;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const byId = useMemo(() => new Map((tags ?? []).map((tag) => [tag.id, tag])), [tags]);
  const badgesOf = useCallback(
    (ids: readonly string[]) =>
      ids.flatMap((id) => {
        const tag = byId.get(id);
        return tag ? [{ id: tag.id, label: tag.label, description: tag.description, color: tag.color, adminOnly: tag.visibility === 'admin' }] : [];
      }),
    [byId],
  );

  return { tags, error, reload, badgesOf };
}
