import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Decimal } from '../engine/decimal';
import type { Feature, GameContent, ProfessorDef } from '../content/types';
import type { GameState } from '../engine/state';
import type { Stats } from '../engine/stats';
import {
  abilityViews,
  achievementViews,
  clickUpgradeViews,
  clickValue,
  coinsPerSecond,
  comboInfo,
  disciplineViews,
  graduationPreview,
  hasFeature,
  prestigeNodeViews,
  professorViews,
  researchViews,
  statsOf,
} from '../engine/views';
import type { ComboInfo } from '../engine/views';
import { subscribeGameEvents } from './bus';
import type {
  AbilityView,
  AchievementView,
  GameEvent,
  GameEventType,
  GraduationPreview,
  LevelledView,
  PrestigeNodeView,
  ProfessorView,
  ResearchView,
} from './types';
import { content, useGame } from './useGame';

// ---------------------------------------------------------------------------
// State selectors
// ---------------------------------------------------------------------------

/** Selects from the published GameState. Return primitives, Decimals or nested data of the state; use useGameStateShallow for fresh objects. */
export function useGameState<T>(selector: (state: GameState) => T): T {
  return useGame((store) => selector(store.state));
}

/** Like useGameState for selectors that build a new object or array each call. */
export function useGameStateShallow<T>(selector: (state: GameState) => T): T {
  return useGame(useShallow((store) => selector(store.state)));
}

/**
 * Builds a view from the published state and the content, recomputed when the state changes
 * (up to 10 Hz). `build` must be a stable reference, e.g. a module-level function such as
 * `disciplineViews`, or a useCallback.
 */
export function useGameView<T>(build: (state: GameState, content: GameContent) => T): T {
  const state = useGame((store) => store.state);
  return useMemo(() => build(state, content), [state, build]);
}

export const useCoins = (): Decimal => useGameState((state) => state.coins);
export const useCoinsPerSecond = (): Decimal => useGameView(coinsPerSecond);
export const useClickValue = (): Decimal => useGameView(clickValue);
export const useStats = (): Stats => useGameView(statsOf);
export const useCombo = (): ComboInfo => useGameView(comboInfo);

export const useDisciplineViews = (): LevelledView[] => useGameView(disciplineViews);
export const useClickUpgradeViews = (): LevelledView[] => useGameView(clickUpgradeViews);
export const useResearchViews = (): ResearchView[] => useGameView(researchViews);
export const useProfessorViews = (): ProfessorView[] => useGameView(professorViews);
export const useAbilityViews = (): AbilityView[] => useGameView(abilityViews);
export const usePrestigeNodeViews = (): PrestigeNodeView[] => useGameView(prestigeNodeViews);
export const useGraduationPreview = (): GraduationPreview => useGameView(graduationPreview);
export const useAchievementViews = (): AchievementView[] => useGameView(achievementViews);

/** True when a hired professor brings the feature (the layer is unlocked). */
export function useHasFeature(feature: Feature): boolean {
  return useGame((store) => hasFeature(store.state, content, feature));
}

/** The professor on stage. */
export function useActiveProfessor(): ProfessorDef {
  return useGame((store) => content.professors[store.state.activeProfessor]);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Calls `handler` for every game event, or only for the listed `types`. The latest handler is
 * always used, so it can be an inline function; the subscription is made once per mount.
 */
export function useGameEvents(handler: (event: GameEvent) => void, types?: readonly GameEventType[]): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  const typeKey = types ? types.join(',') : null;
  useEffect(() => {
    const wanted = typeKey === null ? null : new Set<string>(typeKey.split(','));
    return subscribeGameEvents((event) => {
      if (!wanted || wanted.has(event.type)) latest.current(event);
    });
  }, [typeKey]);
}
