import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { cachedResearchViews } from '../lib/researchCache';
import { fmt } from '../lib/numbers';

export interface ResearchLists {
  /** Visible and not yet bought, cheapest first. */
  open: string[];
  bought: string[];
  /** Research that has not shown up yet (requirements not met). */
  hidden: number;
}

interface ListKeys {
  open: string;
  bought: string;
  hidden: number;
}

/**
 * Ids only: the lists change when something is bought or revealed, not at every tick. The selector returns
 * joined strings because useShallow compares fields by reference and arrays would always differ.
 */
export function useResearchLists(): ResearchLists {
  const keys = useGame(
    useShallow((store): ListKeys => {
      const views = cachedResearchViews(store.state);
      const open = views.filter((view) => view.visible && !view.bought).sort((a, b) => a.cost.cmp(b.cost));
      return {
        open: open.map((view) => view.id).join(','),
        bought: views.filter((view) => view.bought).map((view) => view.id).join(','),
        hidden: views.filter((view) => !view.visible && !view.bought).length,
      };
    }),
  );
  return useMemo(
    () => ({
      open: keys.open ? keys.open.split(',') : [],
      bought: keys.bought ? keys.bought.split(',') : [],
      hidden: keys.hidden,
    }),
    [keys],
  );
}

export interface ResearchCardData {
  name: string;
  emoji: string;
  description: string;
  professor: string;
  color: string;
  cost: string;
  bought: boolean;
  affordable: boolean;
}

export function useResearchCard(id: string): ResearchCardData | null {
  return useGame(
    useShallow((store): ResearchCardData | null => {
      const view = cachedResearchViews(store.state).find((entry) => entry.id === id);
      if (!view) return null;
      const professor = content.professors[view.professor];
      return {
        name: view.name,
        emoji: view.emoji,
        description: view.description,
        professor: professor.name,
        color: professor.color,
        cost: fmt(view.cost),
        bought: view.bought,
        affordable: view.affordable,
      };
    }),
  );
}
