import type {
  AbilityDef,
  GameContent,
  ProfessorDef,
  Requirement,
  ResearchDef,
} from '../content/types';
import { getIndex } from './contentIndex';
import type { LevelledDef } from './contentIndex';
import { levelOf } from './economy';
import type { GameState } from './state';

export function requirementMet(state: GameState, req: Requirement): boolean {
  switch (req.kind) {
    case 'professorHired':
      return state.hired[req.professor];
    case 'disciplineLevel':
      return levelOf(state, req.discipline) >= req.level;
    case 'research':
      return state.research[req.research] === true;
    case 'graduations':
      return state.counters.graduations >= req.count;
  }
}

/** Ready-to-show pt-BR text for an unmet requirement: "Requer Café Quentinho no nível 10". */
export function requirementText(content: GameContent, req: Requirement): string {
  const index = getIndex(content);
  switch (req.kind) {
    case 'professorHired':
      return `Contrate ${content.professors[req.professor].name}`;
    case 'disciplineLevel':
      return `Requer ${index.disciplines.get(req.discipline)?.name ?? req.discipline} no nível ${req.level}`;
    case 'research':
      return `Requer a pesquisa ${index.research.get(req.research)?.name ?? req.research}`;
    case 'graduations':
      return req.count === 1 ? 'Requer 1 formatura' : `Requer ${req.count} formaturas`;
  }
}

/** Text of the first unmet requirement, or null when all are met. */
export function firstUnmet(state: GameState, content: GameContent, reqs: readonly Requirement[]): string | null {
  for (const req of reqs) {
    if (!requirementMet(state, req)) return requirementText(content, req);
  }
  return null;
}

/** Why a discipline or click upgrade cannot be bought yet, or null when it is unlocked. */
export function levelledLock(state: GameState, content: GameContent, entry: LevelledDef): string | null {
  const professor = entry.def.professor;
  if (!state.hired[professor]) return `Contrate ${content.professors[professor].name}`;

  if (entry.kind === 'clickUpgrade') {
    return firstUnmet(state, content, entry.def.requires);
  }
  const below = getIndex(content).tierBelow.get(entry.def.id);
  if (below && levelOf(state, below.id) < content.balance.tierUnlockLevel) {
    return `Requer ${below.name} no nível ${content.balance.tierUnlockLevel}`;
  }
  return null;
}

/** Why a research is not available yet, or null when its requirements are met. */
export function researchLock(state: GameState, content: GameContent, def: ResearchDef): string | null {
  if (!state.hired[def.professor]) return `Contrate ${content.professors[def.professor].name}`;
  return firstUnmet(state, content, def.requires);
}

/** Why a professor cannot be hired (other than cost), or null. Order: the previous one must be hired. */
export function hireLock(state: GameState, content: GameContent, def: ProfessorDef): string | null {
  const previous = getIndex(content).professorList.find((p) => p.order === def.order - 1);
  if (previous && !state.hired[previous.id]) return `Contrate ${previous.name} primeiro`;
  return firstUnmet(state, content, def.requires);
}

/**
 * An ability is usable when any research that unlocks it is bought. Abilities that no research
 * unlocks are available as soon as their professor is hired.
 */
export function isAbilityUnlocked(state: GameState, content: GameContent, def: AbilityDef): boolean {
  const unlockers = getIndex(content).abilityUnlockers.get(def.id);
  if (unlockers && unlockers.length > 0) return unlockers.some((id) => state.research[id] === true);
  return state.hired[def.professor];
}
