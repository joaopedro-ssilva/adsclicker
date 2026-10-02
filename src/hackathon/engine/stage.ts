import type { DailyModifierDef, EnemyDef, HackathonContent, StageDef } from '../content/types';
import { SALT, createStream, hashString, pickOne, sample } from './rng';
import type { Stream } from './rng';
import type { ResolvedStage } from './types';

export const DAILY_ID = 'daily';
const DAILY_DROP_BASES = 4;
/** The daily is longer than a normal stage (up to 5 waves plus a boss), so it pays 1.5x the average stage. */
const DAILY_REWARD_PERCENT = 150;

function fromCampaign(stage: StageDef): ResolvedStage {
  return {
    id: stage.id,
    name: stage.name,
    level: stage.level,
    boss: stage.boss,
    waves: stage.waves.map((wave) => [...wave]),
    drops: [...stage.drops],
    xp: stage.xp,
    commits: stage.commits,
    arena: stage.arena,
    modifiers: [],
  };
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The last wave is a mini-boss: the toughest common enemy with one random minion. The chapter's
 * real boss stays a set piece of the campaign (without commons, it is all the content has).
 */
function finalWave(enemies: EnemyDef[], commons: EnemyDef[], rng: Stream): string[] {
  const toughest = [...commons].sort((a, b) => b.hp - a.hp || a.id.localeCompare(b.id))[0] ?? enemies[0];
  if (!toughest) return [];
  const minion = pickOne(rng, commons);
  return minion ? [toughest.id, minion.id] : [toughest.id];
}

function dailyWaves(content: HackathonContent, rng: Stream): string[][] {
  const commons = content.enemies.filter((e) => !e.boss);
  const pool = commons.length > 0 ? commons : content.enemies;
  const count = Math.max(1, content.config.daily.waves);
  const waves: string[][] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const size = 1 + Math.floor(rng() * 2);
    const wave: string[] = [];
    for (let j = 0; j < size; j += 1) {
      const enemy = pickOne(rng, pool);
      if (enemy) wave.push(enemy.id);
    }
    waves.push(wave);
  }
  waves.push(finalWave(content.enemies, pool, rng));
  return waves;
}

/**
 * The Hackathon of the day, generated from the date key alone (the same for every player).
 *
 * - Waves: `config.daily.waves`; every wave but the last has 1 or 2 random common enemies, the
 *   last is a mini-boss: the toughest common enemy (by HP) with one random minion. The campaign's
 *   boss never appears in the daily.
 * - Level: the mean level of the campaign's regular (non-boss) stages, rounded: a fair fight for
 *   a build from the middle of the chapter. Difficulty comes from the modifiers, not the date.
 * - Rewards: 1.5x the mean XP and Commits of those stages, plus the modifiers' `xpPercent`.
 * - Modifiers: `config.daily.modifiers` drawn without repeats. Drops: 4 item bases.
 */
export function dailyStage(dateKey: string, content: HackathonContent): ResolvedStage | null {
  if (content.enemies.length === 0) return null;
  const rng = createStream(hashString(dateKey), SALT.daily);
  const regular = content.stages.filter((s) => !s.boss);
  const reference = regular.length > 0 ? regular : content.stages;
  const modifiers: DailyModifierDef[] = sample(rng, content.dailyModifiers, content.config.daily.modifiers);
  const waves = dailyWaves(content, rng);
  const drops = sample(rng, content.items, DAILY_DROP_BASES).map((item) => item.id);
  const arena = pickOne(rng, reference)?.arena ?? '';
  const xpBonus = modifiers.reduce((sum, m) => sum + (m.xpPercent ?? 0), 0);
  return {
    id: DAILY_ID,
    name: 'Hackathon do dia',
    level: Math.max(1, Math.round(average(reference.map((s) => s.level)))),
    boss: false,
    waves,
    drops,
    xp: Math.round((average(reference.map((s) => s.xp)) * DAILY_REWARD_PERCENT * (100 + xpBonus)) / 10000),
    commits: Math.round((average(reference.map((s) => s.commits)) * DAILY_REWARD_PERCENT) / 100),
    arena,
    modifiers,
  };
}

export function resolveStage(id: string, dateKey: string, content: HackathonContent): ResolvedStage | null {
  if (id === DAILY_ID) return dailyStage(dateKey, content);
  const stage = content.stages.find((s) => s.id === id);
  return stage ? fromCampaign(stage) : null;
}
