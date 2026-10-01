import { content as gameContent } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { GameContent } from '@/game/content/types';
import { getIndex } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import type { FeedItem } from '@/shared/api';

export type FeedKind = FeedItem['kind'];

export interface FeedDraft {
  kind: FeedKind;
  /** '' when the kind has no detail. */
  detail: string;
}

/** Cap per sync, so one doctored save cannot flood the feed. */
export const MAX_EVENTS_PER_SYNC = 6;

/**
 * What happened between two saves worth showing to the community: professors hired, the whole
 * faculty complete, a graduation, an epic or legendary skin. Without a previous save there is
 * nothing to compare with, so nothing is announced (a first sync must not replay a whole career).
 * `joined` is not here: it comes from picking the nickname, which the save does not hold.
 */
export function diffFeed(previous: GameState | null, next: GameState, content: GameContent = gameContent): FeedDraft[] {
  if (!previous) return [];
  const drafts: FeedDraft[] = [];

  for (const id of PROFESSOR_IDS) {
    if (next.hired[id] && !previous.hired[id]) drafts.push({ kind: 'hire', detail: id });
  }
  const allBefore = PROFESSOR_IDS.every((id) => previous.hired[id]);
  const allNow = PROFESSOR_IDS.every((id) => next.hired[id]);
  if (allNow && !allBefore) drafts.push({ kind: 'allProfessors', detail: '' });

  if (next.counters.graduations > previous.counters.graduations) {
    drafts.push({ kind: 'graduation', detail: String(Math.floor(next.counters.graduations)) });
  }

  const skins = getIndex(content).skins;
  for (const id in next.skins) {
    if (!next.skins[id] || previous.skins[id]) continue;
    const rarity = skins.get(id)?.rarity;
    if (rarity === 'epic' || rarity === 'legendary') drafts.push({ kind: 'skin', detail: id });
  }

  return drafts.slice(0, MAX_EVENTS_PER_SYNC);
}
