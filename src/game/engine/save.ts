import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import { grantAchievementRewards } from './achievements';
import { getIndex } from './contentIndex';
import { Decimal, ZERO, parseDecimal } from './decimal';
import { createInitialState } from './init';
import { SAVE_VERSION } from './state';
import type { ActiveBuff, ActiveInvasion, ActiveSprint, BuyAmount, GameState, Settings } from './state';

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

const BUFF_SOURCES: ActiveBuff['source'][] = ['ability', 'invasion', 'sprint'];

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
      fresh.active = sprint;
    }
  }
  return fresh;
}

function readSettings(value: unknown, fallback: Settings): Settings {
  if (!isRecord(value)) return fallback;
  const motion = value.reducedMotion;
  return {
    sfxVolume: readNumber(value.sfxVolume, fallback.sfxVolume, 0, 1),
    musicVolume: readNumber(value.musicVolume, fallback.musicVolume, 0, 1),
    muted: typeof value.muted === 'boolean' ? value.muted : fallback.muted,
    musicEnabled: typeof value.musicEnabled === 'boolean' ? value.musicEnabled : fallback.musicEnabled,
    reducedMotion: motion === 'on' || motion === 'off' || motion === 'system' ? motion : fallback.reducedMotion,
    floatingNumbers: typeof value.floatingNumbers === 'boolean' ? value.floatingNumbers : fallback.floatingNumbers,
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

  const counters = isRecord(raw.counters) ? raw.counters : {};
  for (const key of Object.keys(state.counters) as (keyof GameState['counters'])[]) {
    state.counters[key] = readNumber(counters[key], 0, 0);
  }
  state.settings = readSettings(raw.settings, state.settings);

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
