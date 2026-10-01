import { PROFESSOR_IDS } from '../content/types';
import type {
  AbilityDef,
  AchievementDef,
  BuffDef,
  ClickUpgradeDef,
  DisciplineDef,
  GameContent,
  InvasionDef,
  PrestigeNodeDef,
  ProfessorDef,
  ProfessorId,
  ResearchDef,
  SceneryDef,
  SkinDef,
  SprintDef,
  ThemeDef,
} from '../content/types';
import { parseDecimal } from './decimal';
import type { Decimal } from './decimal';

export type LevelledDef =
  | { kind: 'discipline'; def: DisciplineDef }
  | { kind: 'clickUpgrade'; def: ClickUpgradeDef };

/** Lookup tables built once per GameContent. Never mutate. */
export interface ContentIndex {
  content: GameContent;
  /** Professors sorted by hire order. */
  professorList: ProfessorDef[];
  /** The professor hired from the start (order 1). */
  firstProfessor: ProfessorId;
  disciplines: Map<string, DisciplineDef>;
  /** Disciplines of a professor sorted by tier. */
  disciplinesOf: Record<ProfessorId, DisciplineDef[]>;
  /** The discipline one tier below, or null for the first tier. */
  tierBelow: Map<string, DisciplineDef | null>;
  clickUpgrades: Map<string, ClickUpgradeDef>;
  levelled: Map<string, LevelledDef>;
  research: Map<string, ResearchDef>;
  researchOf: Record<ProfessorId, ResearchDef[]>;
  abilities: Map<string, AbilityDef>;
  /** Research ids that unlock an ability (AbilityDef.unlockedByResearch or ResearchDef.unlocksAbility). */
  abilityUnlockers: Map<string, string[]>;
  invasions: Map<string, InvasionDef>;
  sprints: Map<string, SprintDef>;
  prestigeNodes: Map<string, PrestigeNodeDef>;
  achievements: Map<string, AchievementDef>;
  skins: Map<string, SkinDef>;
  sceneries: Map<string, SceneryDef>;
  themes: Map<string, ThemeDef>;
  /** Every BuffDef reachable from abilities, invasion rewards and sprint rewards. */
  buffs: Map<string, BuffDef>;
  defaultSkin: Record<ProfessorId, string>;
  defaultScenery: string;
  defaultTheme: string;
  /** Parsed base costs / productions, by upgrade id. */
  baseCost: Map<string, Decimal>;
  baseOutput: Map<string, Decimal>;
}

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

function perProfessor<T extends { professor: ProfessorId }>(list: T[]): Record<ProfessorId, T[]> {
  const result = {} as Record<ProfessorId, T[]>;
  for (const id of PROFESSOR_IDS) result[id] = [];
  for (const item of list) result[item.professor].push(item);
  return result;
}

function build(content: GameContent): ContentIndex {
  const professorList = PROFESSOR_IDS.map((id) => content.professors[id]).sort((a, b) => a.order - b.order);
  const firstProfessor = professorList[0]?.id ?? PROFESSOR_IDS[0];

  const disciplinesOf = perProfessor(content.disciplines);
  const tierBelow = new Map<string, DisciplineDef | null>();
  for (const id of PROFESSOR_IDS) {
    disciplinesOf[id].sort((a, b) => a.tier - b.tier);
    disciplinesOf[id].forEach((def, i) => tierBelow.set(def.id, disciplinesOf[id][i - 1] ?? null));
  }

  const disciplines = byId(content.disciplines);
  const clickUpgrades = byId(content.clickUpgrades);
  const levelled = new Map<string, LevelledDef>();
  for (const def of content.disciplines) levelled.set(def.id, { kind: 'discipline', def });
  for (const def of content.clickUpgrades) levelled.set(def.id, { kind: 'clickUpgrade', def });

  const abilityUnlockers = new Map<string, string[]>();
  const addUnlocker = (abilityId: string, researchId: string) => {
    const list = abilityUnlockers.get(abilityId) ?? [];
    if (!list.includes(researchId)) list.push(researchId);
    abilityUnlockers.set(abilityId, list);
  };
  for (const ability of content.abilities) {
    if (ability.unlockedByResearch) addUnlocker(ability.id, ability.unlockedByResearch);
  }
  for (const research of content.research) {
    if (research.unlocksAbility) addUnlocker(research.unlocksAbility, research.id);
  }

  const buffs = new Map<string, BuffDef>();
  for (const ability of content.abilities) buffs.set(ability.buff.id, ability.buff);
  for (const invasion of content.invasions) {
    if (invasion.reward.kind === 'buff') buffs.set(invasion.reward.buff.id, invasion.reward.buff);
  }
  for (const sprint of content.sprints) {
    if (sprint.reward.kind === 'buff') buffs.set(sprint.reward.buff.id, sprint.reward.buff);
  }

  const defaultSkin = {} as Record<ProfessorId, string>;
  for (const id of PROFESSOR_IDS) {
    const owned = content.skins.filter((skin) => skin.professor === id);
    defaultSkin[id] = (owned.find((skin) => skin.default) ?? owned[0])?.id ?? '';
  }

  const baseCost = new Map<string, Decimal>();
  const baseOutput = new Map<string, Decimal>();
  for (const def of content.disciplines) {
    baseCost.set(def.id, parseDecimal(def.baseCost));
    baseOutput.set(def.id, parseDecimal(def.baseProduction));
  }
  for (const def of content.clickUpgrades) {
    baseCost.set(def.id, parseDecimal(def.baseCost));
    baseOutput.set(def.id, parseDecimal(def.baseClick));
  }

  return {
    content,
    professorList,
    firstProfessor,
    disciplines,
    disciplinesOf,
    tierBelow,
    clickUpgrades,
    levelled,
    research: byId(content.research),
    researchOf: perProfessor(content.research),
    abilities: byId(content.abilities),
    abilityUnlockers,
    invasions: byId(content.invasions),
    sprints: byId(content.sprints),
    prestigeNodes: byId(content.prestigeNodes),
    achievements: byId(content.achievements),
    skins: byId(content.skins),
    sceneries: byId(content.sceneries),
    themes: byId(content.themes),
    buffs,
    defaultSkin,
    defaultScenery: (content.sceneries.find((s) => s.default) ?? content.sceneries[0])?.id ?? '',
    defaultTheme: (content.themes.find((t) => t.default) ?? content.themes[0])?.id ?? '',
    baseCost,
    baseOutput,
  };
}

const cache = new WeakMap<GameContent, ContentIndex>();

export function getIndex(content: GameContent): ContentIndex {
  let index = cache.get(content);
  if (!index) {
    index = build(content);
    cache.set(content, index);
  }
  return index;
}
