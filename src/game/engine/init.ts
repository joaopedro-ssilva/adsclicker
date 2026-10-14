import { MONITOR_IDS, PROFESSOR_IDS } from '../content/types';
import type { CounterKey, GameContent, ProfessorId } from '../content/types';
import { getIndex } from './contentIndex';
import { ZERO } from './decimal';
import { createMaestriaState } from './maestria/slots';
import { SAVE_VERSION } from './state';
import type { GameState, MonitorsState, RunStats, Settings } from './state';

export function createCounters(): Record<CounterKey, number> {
  return {
    clicks: 0,
    crits: 0,
    maxCombo: 0,
    eventsDefended: 0,
    eventsMissed: 0,
    bestEventStreak: 0,
    abilitiesUsed: 0,
    sprintsCompleted: 0,
    sprintsFailed: 0,
    levelsBought: 0,
    researchBought: 0,
    graduations: 0,
    professorSwaps: 0,
    biggestPurchase: 0,
    bestDayStreak: 0,
    playSeconds: 0,
    offlineCollections: 0,
    cafesBought: 0,
  };
}

export function createRunStats(): RunStats {
  return {
    seconds: 0,
    clicks: 0,
    levelsBought: 0,
    clickCoins: ZERO,
    sprintsCompleted: 0,
    sprintsFailed: 0,
    eventsDefended: 0,
    eventsMissed: 0,
  };
}

export function createMonitorsState(): MonitorsState {
  const units = {} as MonitorsState['units'];
  for (const id of MONITOR_IDS) units[id] = { level: 0, on: true, nextAt: 0, done: 0, last: '' };
  return { units, settings: { comprasShare: 0.5, pesquisaShare: 0.5, sprintPick: 'first' } };
}

export function defaultSettings(): Settings {
  return {
    sfxVolume: 0.7,
    musicVolume: 0.35,
    muted: false,
    musicEnabled: false,
    reducedMotion: 'system',
    floatingNumbers: true,
    devMultiplier: 1,
  };
}

/** A brand-new game: the first professor hired and on stage, default cosmetics owned. */
export function createInitialState(content: GameContent, now: number): GameState {
  const index = getIndex(content);

  const hired = {} as Record<ProfessorId, boolean>;
  for (const id of PROFESSOR_IDS) hired[id] = id === index.firstProfessor;

  const skins: Record<string, boolean> = {};
  const equippedSkin = {} as Record<ProfessorId, string>;
  for (const id of PROFESSOR_IDS) {
    const skinId = index.defaultSkin[id];
    equippedSkin[id] = skinId;
    if (skinId) skins[skinId] = true;
  }

  return {
    version: SAVE_VERSION,

    coins: ZERO,
    runCoins: ZERO,
    lifetimeCoins: ZERO,
    diplomas: 0,
    diplomasEarned: 0,

    hired,
    activeProfessor: index.firstProfessor,

    levels: {},
    research: {},
    prestige: {},
    buyAmount: 1,

    achievements: {},
    secrets: {},
    skins,
    equippedSkin,
    sceneries: index.defaultScenery ? { [index.defaultScenery]: true } : {},
    equippedScenery: index.defaultScenery,
    themes: index.defaultTheme ? { [index.defaultTheme]: true } : {},
    equippedTheme: index.defaultTheme,

    combo: { steps: 0, lastClickAt: 0 },
    autoClickCarry: 0,

    buffs: [],
    abilityReadyAt: {},
    invasion: null,
    nextInvasionAt: 0,
    invasionSeq: 0,
    eventStreak: 0,
    sprint: { offers: [], active: null, nextOffersAt: 0 },

    run: createRunStats(),
    lastRun: null,
    honoured: null,
    honouredBefore: {},
    abilitiesTried: {},
    maestria: createMaestriaState(),
    monitors: createMonitorsState(),
    session: { seconds: 0, activeAt: now },
    calendar: { day: 0, streak: 0, gradDay: 0, gradsToday: 0 },

    counters: createCounters(),
    settings: defaultSettings(),
    cloudBonus: { cargo: 1, mentors: {} },

    lastAchievementCheckAt: 0,
    createdAt: now,
    lastTickAt: now,
    lastSavedAt: now,
  };
}
