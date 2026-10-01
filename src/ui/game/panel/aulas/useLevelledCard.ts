import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { levelledView } from '@/game/engine/views';
import { fmt } from '../lib/numbers';

/** Segments of the milestone bar. */
export const MILESTONE_SEGMENTS = 10;

/** Everything a card shows, as primitives, so a card only re-renders when something visible changes. */
export interface CardData {
  kind: 'discipline' | 'clickUpgrade';
  name: string;
  emoji: string;
  description: string;
  level: number;
  unlocked: boolean;
  lockReason: string | null;
  buyCount: number;
  cost: string;
  affordable: boolean;
  output: string;
  gain: string;
  nextMilestone: number | null;
  filledSegments: number;
  /** Percent of the total coins/second, whole number. */
  share: number;
}

/** Subscribes to one discipline or click upgrade. The selector returns flat strings and numbers. */
export function useLevelledCard(id: string): CardData | null {
  return useGame(
    useShallow((store): CardData | null => {
      const view = levelledView(store.state, content, id);
      if (!view) return null;
      return {
        kind: view.kind,
        name: view.name,
        emoji: view.emoji,
        description: view.description,
        level: view.level,
        unlocked: view.unlocked,
        lockReason: view.lockReason,
        buyCount: view.buyCount,
        cost: fmt(view.cost),
        affordable: view.affordable,
        output: fmt(view.output),
        gain: fmt(view.outputGain),
        nextMilestone: view.nextMilestone,
        filledSegments: Math.floor(view.milestoneProgress * MILESTONE_SEGMENTS),
        share: Math.round(view.share * 100),
      };
    }),
  );
}
