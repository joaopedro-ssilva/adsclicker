import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import { grantAchievementRewards } from './achievements';
import { getIndex } from './contentIndex';
import { Decimal, ZERO, parseDecimal } from './decimal';
import { isValidFavourite } from './favourites';
import { createInitialState, createMonitorsState, createRecords, createRunStats } from './init';
import { readMaestria } from './maestria/save';
import {
  MAX_CARGO_BONUS,
  MAX_DEV_MULTIPLIER,
  MAX_MENTOR_BONUS,
  MIN_DEV_MULTIPLIER,
  MONITOR_SHARES,
  RECORD_KEYS,
  SAVE_VERSION,
  SPRINT_PICKS,
} from './state';
import type {
  ActiveBuff,
  ActiveInvasion,
  ActiveSprint,
  BuyAmount,
  CloudBonus,
  GameState,
  LastRun,
  MonitorsState,
  RecordKey,
  Records,
  RunStats,
  RunSummary,
  Settings,
} from './state';

export type RawSave = Record<string, unknown>;
export type Migration = (raw: RawSave) => RawSave;

/**
 * MIGRATIONS[n - 1] turns a save of version n into version n + 1. Add one here whenever
 * SAVE_VERSION is bumped for a change that merging over a fresh state cannot absorb
 * (a renamed or reinterpreted field). Additive fields need no migration.
 */
export const MIGRATIONS: Migration[] = [];

/** Runs every migration from the save's version up to `target`. A missing step is skipped. */
export function migrateSave(raw: RawSave, migrations: readonly Migration[] = MIGRATIONS, target = SAVE_VERSION): RawSave {
  let current = raw;
  let version = typeof current.version === 'number' && Number.isFinite(current.version) ? Math.floor(current.version) : 1;
  while (version < target) {
    const step = migrations[version - 1];
    current = step ? step(current) : current;
    version += 1;
    current = { ...current, version };
  }
  return current;
}

// ---------------------------------------------------------------------------
// Tolerant readers
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readDecimal(value: unknown): Decimal {
  if (typeof value === 'string') return parseDecimal(value).lt(0) ? ZERO : parseDecimal(value);
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return new Decimal(value);
  return ZERO;
}

function readBooleans(value: unknown, known: (key: string) => boolean): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!isRecord(value)) return result;
  for (const key in value) if (value[key] === true && known(key)) result[key] = true;
  return result;
}

function readNumbers(value: unknown, known: (key: string) => boolean, min = 0, max = Infinity): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(value)) return result;
  for (const key in value) {
    const n = value[key];
    if (known(key) && typeof n === 'number' && Number.isFinite(n)) result[key] = Math.min(max, Math.max(min, n));
  }
  return result;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

const BUFF_SOURCES: ActiveBuff['source'][] = ['ability', 'invasion', 'sprint', 'maestria'];

function readBuffs(value: unknown, content: GameContent): ActiveBuff[] {
  const index = getIndex(content);
  const buffs: ActiveBuff[] = [];
  if (!Array.isArray(value)) return buffs;
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = readString(entry.id);
    const def = id ? index.buffs.get(id) : undefined;
    const source = BUFF_SOURCES.find((s) => s === entry.source);
    if (!def || !source || typeof entry.endsAt !== 'number' || !Number.isFinite(entry.endsAt)) continue;
    buffs.push({
      id: def.id,
      name: def.name,
      emoji: def.emoji,
      effects: def.effects,
      startedAt: readNumber(entry.startedAt, entry.endsAt),
      endsAt: entry.endsAt,
      source,
    });
  }
  return buffs;
}

function readInvasion(value: unknown, content: GameContent): ActiveInvasion | null {
  if (!isRecord(value)) return null;
  const def = getIndex(content).invasions.get(readString(value.def) ?? '');
  if (!def || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) return null;
  return {
    uid: readNumber(value.uid, 0),
    def: def.id,
    spawnedAt: readNumber(value.spawnedAt, value.expiresAt),
    expiresAt: value.expiresAt,
    clicksLeft: Math.max(1, Math.floor(readNumber(value.clicksLeft, def.clicksRequired))),
    x: readNumber(value.x, 0.5, 0, 1),
    y: readNumber(value.y, 0.5, 0, 1),
  };
}

function readSprint(value: unknown, content: GameContent): GameState['sprint'] {
  const index = getIndex(content);
  const fresh: GameState['sprint'] = { offers: [], active: null, nextOffersAt: 0 };
  if (!isRecord(value)) return fresh;

  if (Array.isArray(value.offers)) {
    fresh.offers = value.offers.filter((id): id is string => typeof id === 'string' && index.sprints.has(id));
  }
  fresh.nextOffersAt = readNumber(value.nextOffersAt, 0);

  const active = value.active;
  if (isRecord(active)) {
    const def = index.sprints.get(readString(active.def) ?? '');
    if (def && typeof active.endsAt === 'number' && Number.isFinite(active.endsAt)) {
      const sprint: ActiveSprint = {
        def: def.id,
        startedAt: readNumber(active.startedAt, active.endsAt),
        endsAt: active.endsAt,
        progress: readNumber(active.progress, 0, 0),
        target: def.goal.amount,
      };
      const refCps = readString(active.refCps);
      if (refCps) sprint.refCps = refCps;
      if (active.auto === true) sprint.auto = true;
      fresh.active = sprint;
    }
  }
  return fresh;
}

/** Monitores: levels capped at the content's, settings limited to the values the UI offers, ids checked. */
function readMonitors(value: unknown, content: GameContent, now: number): MonitorsState {
  const monitors = createMonitorsState();
  if (!isRecord(value)) return monitors;
  const index = getIndex(content);
  const units = isRecord(value.units) ? value.units : {};

  for (const def of content.monitors) {
    const raw = units[def.id];
    if (!isRecord(raw)) continue;
    const last = readString(raw.last) ?? '';
    const known = def.id === 'compras' ? index.disciplines : def.id === 'pesquisa' ? index.research : def.id === 'seguranca' ? index.invasions : index.sprints;
    monitors.units[def.id] = {
      level: Math.floor(readNumber(raw.level, 0, 0, def.levels.length)),
      on: raw.on !== false,
      nextAt: readNumber(raw.nextAt, 0, 0, now),
      done: Math.floor(readNumber(raw.done, 0, 0)),
      last: known.has(last) ? last : '',
    };
  }

  if (isRecord(value.settings)) {
    const settings = value.settings;
    const share = (raw: unknown, fallback: number) => MONITOR_SHARES.find((option) => option === raw) ?? fallback;
    monitors.settings = {
      comprasShare: share(settings.comprasShare, monitors.settings.comprasShare),
      pesquisaShare: share(settings.pesquisaShare, monitors.settings.pesquisaShare),
      sprintPick: SPRINT_PICKS.find((option) => option === settings.sprintPick) ?? monitors.settings.sprintPick,
    };
  }
  return monitors;
}

function readRun(value: unknown): RunStats {
  const run = createRunStats();
  if (!isRecord(value)) return run;
  run.seconds = readNumber(value.seconds, 0, 0);
  run.clicks = Math.floor(readNumber(value.clicks, 0, 0));
  run.levelsBought = Math.floor(readNumber(value.levelsBought, 0, 0));
  run.clickCoins = readDecimal(value.clickCoins);
  run.sprintsCompleted = Math.floor(readNumber(value.sprintsCompleted, 0, 0));
  run.sprintsFailed = Math.floor(readNumber(value.sprintsFailed, 0, 0));
  run.eventsDefended = Math.floor(readNumber(value.eventsDefended, 0, 0));
  run.eventsMissed = Math.floor(readNumber(value.eventsMissed, 0, 0));
  run.maxCombo = Math.floor(readNumber(value.maxCombo, 0, 0));
  run.autoClickCoins = readDecimal(value.autoClickCoins);
  run.eventCoins = readDecimal(value.eventCoins);
  run.sprintCoins = readDecimal(value.sprintCoins);
  run.offlineCoins = readDecimal(value.offlineCoins);
  run.extraCoins = readDecimal(value.extraCoins);
  return run;
}

function readRecordKeys(value: unknown): RecordKey[] {
  return Array.isArray(value) ? RECORD_KEYS.filter((key) => value.includes(key)) : [];
}

function readSummary(value: unknown): RunSummary | undefined {
  if (!isRecord(value) || !isRecord(value.coins)) return undefined;
  const coin = (raw: unknown) => readDecimal(raw).toString();
  return {
    diplomas: Math.floor(readNumber(value.diplomas, 0, 0)),
    bonus: Math.floor(readNumber(value.bonus, 0, 0)),
    capped: value.capped === true,
    honoured: isProfessorId(value.honoured) ? value.honoured : null,
    maxCombo: Math.floor(readNumber(value.maxCombo, 0, 0)),
    coins: {
      total: coin(value.coins.total),
      classes: coin(value.coins.classes),
      clicks: coin(value.coins.clicks),
      autoClicks: coin(value.coins.autoClicks),
      events: coin(value.coins.events),
      sprints: coin(value.coins.sprints),
      offline: coin(value.coins.offline),
      other: coin(value.coins.other),
    },
    recordsBeaten: readRecordKeys(value.recordsBeaten),
    recordsStarted: readRecordKeys(value.recordsStarted),
  };
}

function readRecords(value: unknown): Records {
  const records = createRecords();
  if (!isRecord(value)) return records;
  records.fastestSeconds = readNumber(value.fastestSeconds, 0, 0);
  records.mostClicks = Math.floor(readNumber(value.mostClicks, 0, 0));
  records.biggestCombo = Math.floor(readNumber(value.biggestCombo, 0, 0));
  records.mostCoins = readDecimal(value.mostCoins);
  return records;
}

function readLastRun(value: unknown): LastRun | null {
  if (!isRecord(value)) return null;
  const summary = readSummary(value.summary);
  return {
    ...(summary ? { summary } : {}),
    seconds: readNumber(value.seconds, 0, 0),
    clicks: Math.floor(readNumber(value.clicks, 0, 0)),
    investedProfessors: Math.floor(readNumber(value.investedProfessors, 0, 0, PROFESSOR_IDS.length)),
    clickShare: readNumber(value.clickShare, 0, 0, 1),
    sprintsCompleted: Math.floor(readNumber(value.sprintsCompleted, 0, 0)),
    sprintsFailed: Math.floor(readNumber(value.sprintsFailed, 0, 0)),
    eventsDefended: Math.floor(readNumber(value.eventsDefended, 0, 0)),
    eventsMissed: Math.floor(readNumber(value.eventsMissed, 0, 0)),
  };
}

function readCalendar(value: unknown, fallback: GameState['calendar']): GameState['calendar'] {
  if (!isRecord(value)) return fallback;
  return {
    day: Math.floor(readNumber(value.day, 0, 0)),
    streak: Math.floor(readNumber(value.streak, 0, 0)),
    gradDay: Math.floor(readNumber(value.gradDay, 0, 0)),
    gradsToday: Math.floor(readNumber(value.gradsToday, 0, 0)),
  };
}

export function readCloudBonus(value: unknown): CloudBonus {
  const bonus: CloudBonus = { cargo: 1, mentors: {} };
  if (!isRecord(value)) return bonus;
  bonus.cargo = readNumber(value.cargo, 1, 1, MAX_CARGO_BONUS);
  if (isRecord(value.mentors)) {
    for (const id of PROFESSOR_IDS) {
      const mentor = readNumber(value.mentors[id], 1, 1, MAX_MENTOR_BONUS);
      if (mentor !== 1) bonus.mentors[id] = mentor;
    }
  }
  return bonus;
}

function readSettings(value: unknown, fallback: Settings): Settings {
  if (!isRecord(value)) return fallback;
  const motion = value.reducedMotion;
  return {
    sfxVolume: readNumber(value.sfxVolume, fallback.sfxVolume, 0, 1),
    musicVolume: readNumber(value.musicVolume, fallback.musicVolume, 0, 1),
    muted: typeof value.muted === 'boolean' ? value.muted : fallback.muted,
    musicEnabled: typeof value.musicEnabled === 'boolean' ? value.musicEnabled : fallback.musicEnabled,
    clickSound: typeof value.clickSound === 'boolean' ? value.clickSound : fallback.clickSound,
    reducedMotion: motion === 'on' || motion === 'off' || motion === 'system' ? motion : fallback.reducedMotion,
    floatingNumbers: typeof value.floatingNumbers === 'boolean' ? value.floatingNumbers : fallback.floatingNumbers,
    sceneryEffects: typeof value.sceneryEffects === 'boolean' ? value.sceneryEffects : fallback.sceneryEffects,
    devMultiplier: readNumber(value.devMultiplier, fallback.devMultiplier, MIN_DEV_MULTIPLIER, MAX_DEV_MULTIPLIER),
  };
}

function readBuyAmount(value: unknown): BuyAmount {
  return value === 10 || value === 'max' ? value : 1;
}

function isProfessorId(value: unknown): value is ProfessorId {
  return PROFESSOR_IDS.some((id) => id === value);
}

/**
 * Builds a GameState from parsed save data, merging over a fresh initial state: missing fields
 * keep their defaults, unknown fields and ids that no longer exist in the content are dropped.
 */
export function mergeSave(raw: RawSave, content: GameContent, now: number): GameState {
  const index = getIndex(content);
  const state = createInitialState(content, now);

  state.coins = readDecimal(raw.coins);
  state.runCoins = readDecimal(raw.runCoins);
  state.lifetimeCoins = Decimal.max(readDecimal(raw.lifetimeCoins), state.runCoins);
  state.diplomas = Math.floor(readNumber(raw.diplomas, 0, 0));
  state.diplomasEarned = Math.max(state.diplomas, Math.floor(readNumber(raw.diplomasEarned, 0, 0)));

  const hired = isRecord(raw.hired) ? raw.hired : {};
  for (const id of PROFESSOR_IDS) state.hired[id] = id === index.firstProfessor || hired[id] === true;
  state.activeProfessor =
    isProfessorId(raw.activeProfessor) && state.hired[raw.activeProfessor] ? raw.activeProfessor : index.firstProfessor;

  state.levels = readNumbers(raw.levels, (id) => index.levelled.has(id));
  for (const id in state.levels) {
    const level = Math.floor(state.levels[id] ?? 0);
    if (level > 0) state.levels[id] = level;
    else delete state.levels[id];
  }
  state.research = readBooleans(raw.research, (id) => index.research.has(id));
  state.prestige = {};
  const prestige = readNumbers(raw.prestige, (id) => index.prestigeNodes.has(id));
  for (const id in prestige) {
    const max = index.prestigeNodes.get(id)?.maxLevel ?? 0;
    const level = Math.min(max, Math.floor(prestige[id] ?? 0));
    if (level > 0) state.prestige[id] = level;
  }
  state.buyAmount = readBuyAmount(raw.buyAmount);

  const triggers = new Set<string>();
  for (const def of content.achievements) if (def.condition.kind === 'secret') triggers.add(def.condition.trigger);
  state.achievements = readNumbers(raw.achievements, (id) => index.achievements.has(id), 0);
  state.secrets = readBooleans(raw.secrets, (trigger) => triggers.has(trigger));

  Object.assign(state.skins, readBooleans(raw.skins, (id) => index.skins.has(id)));
  Object.assign(state.sceneries, readBooleans(raw.sceneries, (id) => index.sceneries.has(id)));
  Object.assign(state.themes, readBooleans(raw.themes, (id) => index.themes.has(id)));
  // Cosmetics from achievements that were added to the content after the save was written.
  for (const id in state.achievements) {
    const def = index.achievements.get(id);
    if (def) grantAchievementRewards(state, content, def, () => undefined);
  }

  const equipped = isRecord(raw.equippedSkin) ? raw.equippedSkin : {};
  for (const id of PROFESSOR_IDS) {
    const choice = readString(equipped[id]);
    const skin = choice ? index.skins.get(choice) : undefined;
    if (skin && skin.professor === id && state.skins[skin.id]) state.equippedSkin[id] = skin.id;
  }
  const scenery = readString(raw.equippedScenery);
  if (scenery && state.sceneries[scenery]) state.equippedScenery = scenery;
  const theme = readString(raw.equippedTheme);
  if (theme && state.themes[theme]) state.equippedTheme = theme;
  // Absent in older saves: starts empty. Unknown ids and cosmetics not owned are dropped.
  state.favourites = readBooleans(raw.favourites, (key) => isValidFavourite(state, content, key));

  if (isRecord(raw.combo)) {
    state.combo = { steps: readNumber(raw.combo.steps, 0, 0), lastClickAt: readNumber(raw.combo.lastClickAt, 0, 0) };
  }
  state.autoClickCarry = readNumber(raw.autoClickCarry, 0, 0, 1);

  state.buffs = readBuffs(raw.buffs, content);
  state.abilityReadyAt = readNumbers(raw.abilityReadyAt, (id) => index.abilities.has(id), 0);
  state.invasion = readInvasion(raw.invasion, content);
  state.nextInvasionAt = readNumber(raw.nextInvasionAt, 0, 0);
  state.invasionSeq = Math.max(readNumber(raw.invasionSeq, 0, 0), state.invasion?.uid ?? 0);
  state.eventStreak = Math.floor(readNumber(raw.eventStreak, 0, 0));
  state.sprint = readSprint(raw.sprint, content);

  state.run = readRun(raw.run);
  state.lastRun = readLastRun(raw.lastRun);
  state.records = readRecords(raw.records);
  state.honoured = isProfessorId(raw.honoured) ? raw.honoured : null;
  state.honouredBefore = readBooleans(raw.honouredBefore, isProfessorId);
  state.abilitiesTried = readBooleans(raw.abilitiesTried, (id) => index.abilities.has(id));
  state.maestria = readMaestria(raw.maestria, content);
  state.monitors = readMonitors(raw.monitors, content, now);
  if (isRecord(raw.session)) {
    state.session = { seconds: readNumber(raw.session.seconds, 0, 0), activeAt: readNumber(raw.session.activeAt, now, 0, now) };
  }
  state.calendar = readCalendar(raw.calendar, state.calendar);

  const counters = isRecord(raw.counters) ? raw.counters : {};
  for (const key of Object.keys(state.counters) as (keyof GameState['counters'])[]) {
    state.counters[key] = readNumber(counters[key], 0, 0);
  }
  state.settings = readSettings(raw.settings, state.settings);
  state.cloudBonus = readCloudBonus(raw.cloudBonus);

  state.lastAchievementCheckAt = readNumber(raw.lastAchievementCheckAt, 0, 0, now);
  state.createdAt = readNumber(raw.createdAt, now, 0, now);
  state.lastTickAt = readNumber(raw.lastTickAt, now, 0, now);
  state.lastSavedAt = readNumber(raw.lastSavedAt, now, 0, now);
  state.version = SAVE_VERSION;
  return state;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** JSON text of the save. Decimals are written as strings. */
export function serializeState(state: GameState): string {
  return JSON.stringify({
    ...state,
    coins: state.coins.toString(),
    runCoins: state.runCoins.toString(),
    lifetimeCoins: state.lifetimeCoins.toString(),
    run: {
      ...state.run,
      clickCoins: state.run.clickCoins.toString(),
      autoClickCoins: state.run.autoClickCoins.toString(),
      eventCoins: state.run.eventCoins.toString(),
      sprintCoins: state.run.sprintCoins.toString(),
      offlineCoins: state.run.offlineCoins.toString(),
      extraCoins: state.run.extraCoins.toString(),
    },
    records: { ...state.records, mostCoins: state.records.mostCoins.toString() },
  });
}

/** Parses, migrates and merges a save. Returns null when the text is not a usable save; never throws. */
export function deserializeState(json: string, content: GameContent, now: number): GameState | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed) || typeof parsed.version !== 'number') return null;
    return mergeSave(migrateSave(parsed), content, now);
  } catch {
    return null;
  }
}

function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(data: string): string {
  const binary = atob(data);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** The save as a base64 string the player can copy or download. */
export function exportSave(state: GameState): string {
  return toBase64(serializeState(state));
}

/** Reads what exportSave produced (raw JSON is accepted too). Returns null for anything else. */
export function importSave(data: string, content: GameContent, now: number): GameState | null {
  try {
    const text = data.trim();
    const json = text.startsWith('{') ? text : fromBase64(text.replace(/\s+/g, ''));
    return deserializeState(json, content, now);
  } catch {
    return null;
  }
}
