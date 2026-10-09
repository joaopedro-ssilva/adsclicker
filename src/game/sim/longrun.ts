/**
 * `npx tsx src/game/sim/longrun.ts` — one long simulation and the times (in hours of play) of the things the owner asks about:
 * every achievement that grants a skin, scenery or theme, graduations by hour, the milestones of the mythic candidates
 * and the "rush" graduation. Slow: a 150 h active run takes several minutes.
 *
 *   npx tsx src/game/sim/longrun.ts --profile active --hours 150
 *   npx tsx src/game/sim/longrun.ts --profile casual --hours 150 --away 600,3000 --honour rotate
 *   npx tsx src/game/sim/longrun.ts --profile active --hours 60 --defend 0.98 --guard off     (streaks)
 *
 * Flags: --profile active|casual|idle, --hours, --seed, --away play,away (seconds), --honour (as run.ts, default rotate:
 * the best professor not honoured yet, so Volta Olímpica is reachable), --defend, --guard auto|off|max, --rush h1,h2,...
 * (hours of an active save at which a fresh run is played only to the minimum to graduate, default 20,40,80,120), --set (as run.ts).
 */
import { content as baseContent } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { maestriaLevel } from '../engine/maestria';
import { deserializeState, serializeState } from '../engine/save';
import { applyOverrides } from './overrides';
import { PROFILES } from './profiles';
import type { ProfileId } from './profiles';
import { simulate } from './simulate';
import type { SimOptions } from './simulate';

const flags = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const key = argv[i];
  if (!key?.startsWith('--')) continue;
  const value = argv[i + 1];
  if (value !== undefined && !value.startsWith('--')) flags.set(key.slice(2), value);
  else flags.set(key.slice(2), 'true');
}
const num = (name: string): number | undefined => {
  const parsed = Number(flags.get(name));
  return flags.has(name) && Number.isFinite(parsed) ? parsed : undefined;
};

const content = applyOverrides(baseContent, flags.get('set'));
const profileId = (flags.get('profile') ?? 'active') as ProfileId;
const hours = num('hours') ?? 100;
const options: SimOptions = { ...PROFILES[profileId].options, maxSeconds: hours * 3600, stopWhenDone: false, honour: 'rotate', sampleSeconds: 3600 };
if (num('seed') !== undefined) options.seed = num('seed');
if (num('defend') !== undefined) options.defendRate = num('defend');
if (flags.has('honour')) options.honour = flags.get('honour') as SimOptions['honour'];
if (flags.has('guard')) options.guard = flags.get('guard') as SimOptions['guard'];
const away = flags.get('away');
if (away) {
  const [play, gone] = away.split(',').map(Number);
  if (play && gone) options.away = { playSeconds: play, awaySeconds: gone };
}
const rushAt = (flags.get('rush') ?? '20,40,80,120').split(',').map(Number).filter((h) => h > 0 && h < hours);

const h = (seconds: number | undefined | null): string => (seconds === undefined || seconds === null ? 'never' : `${(seconds / 3600).toFixed(2)} h`);

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const first: Record<string, number> = {};
const mark = (key: string, seconds: number): void => {
  if (first[key] === undefined) first[key] = seconds;
};
const gradsAt: Record<number, number> = {};
const snapshots = new Map<number, { json: string; now: number; seconds: number }>();
const checkpoints = [40, 80, 120, 150].filter((c) => c <= hours);
const started = Date.now();

const result = simulate(content, {
  ...options,
  onStep: (state, seconds) => {
    const c = state.counters;
    if (c.clicks >= 1_000_000) mark('clicks-1m', seconds);
    if (c.abilitiesUsed >= 1000) mark('abilities-1000', seconds);
    if (c.bestEventStreak >= 50) mark('streak-50', seconds);
    if (c.bestEventStreak >= 100) mark('streak-100', seconds);
    for (const n of [25, 30, 40, 50]) if (c.graduations >= n) mark(`grads-${n}`, seconds);
    if (PROFESSOR_IDS.every((id) => maestriaLevel(state, id) >= 5)) mark('maestrias-level5', seconds);
    for (const cp of checkpoints) if (seconds >= cp * 3600 && gradsAt[cp] === undefined) gradsAt[cp] = c.graduations;
    for (const at of rushAt) {
      if (seconds >= at * 3600 && !snapshots.has(at) && state.run.seconds < 15 && c.graduations > 0) {
        snapshots.set(at, { json: serializeState(state), now: state.lastTickAt, seconds });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

console.log(`\n=== ${PROFILES[profileId].label}${away ? ` (away ${away})` : ''}, ${hours} h, seed ${result.options.seed}, honour ${result.options.honour}, defend ${result.options.defendRate}, guard ${result.options.guard} — ran in ${Math.round((Date.now() - started) / 1000)} s ===`);
console.log(`graduations done: ${result.finalState.counters.graduations}; by hour ${checkpoints.map((cp) => `${cp}: ${gradsAt[cp] ?? '-'}`).join(', ')}`);

console.log('\nAchievements that grant a skin, scenery or theme (first time):');
const rarityOf = (skin: string): string => content.skins.find((s) => s.id === skin)?.rarity ?? '?';
const rewarding = content.achievements.filter((a) => a.reward && (a.reward.skin || a.reward.scenery || a.reward.theme));
for (const a of rewarding) {
  const what = a.reward?.skin ? `skin ${rarityOf(a.reward.skin)}` : a.reward?.scenery ? 'scenery' : 'theme';
  console.log(`  ${a.id.padEnd(22)} ${what.padEnd(14)} ${h(result.achievementTimes[a.id])}`);
}

console.log('\nLast achievement to complete each skin rarity:');
for (const rarity of ['rare', 'epic', 'legendary']) {
  const list = rewarding.filter((a) => a.reward?.skin && rarityOf(a.reward.skin) === rarity);
  const missing = list.filter((a) => result.achievementTimes[a.id] === undefined);
  const last = list.reduce<{ id: string; at: number } | null>((best, a) => {
    const at = result.achievementTimes[a.id];
    return at !== undefined && (!best || at > best.at) ? { id: a.id, at } : best;
  }, null);
  console.log(`  ${rarity.padEnd(10)} ${missing.length ? `never (missing: ${missing.map((a) => a.id).join(', ')})` : `${h(last?.at)} (last: ${last?.id})`}  [${list.length} achievements]`);
}

const durations = result.runs.filter((r) => r.endedAt !== null).map((r) => ({ index: r.index + 1, minutes: ((r.endedAt ?? 0) - r.startedAt) / 60, end: r.endedAt ?? 0 }));
const firstUnder = (minutes: number) => durations.find((d) => d.minutes < minutes);
const under5 = firstUnder(5);
const under3 = firstUnder(3);
const under10 = firstUnder(10);
console.log('\nCandidates:');
const line = (label: string, value: string) => console.log(`  ${label.padEnd(34)} ${value}`);
for (const id of ['click-1m', 'mastery-gladimir', 'rares-all', 'streak-100', 'grad-perfect', 'maestrias-all', 'research-all', 'grad-fast', 'honour-all', 'grad-25', 'skins-all']) {
  line(id, h(result.achievementTimes[id]));
}
line('25 / 30 / 40 / 50 graduations', [25, 30, 40, 50].map((n) => h(first[`grads-${n}`])).join(' / '));
line('1,000 abilities used', h(first['abilities-1000']));
line('1,000,000 clicks', h(first['clicks-1m']));
line('streak 50 / 100 in a row', `${h(first['streak-50'])} / ${h(first['streak-100'])}`);
line('every Maestria at level 5', h(first['maestrias-level5']));
line('first run under 10 / 5 / 3 min', `${h(under10?.end)} (#${under10?.index ?? '-'}) / ${h(under5?.end)} (#${under5?.index ?? '-'}) / ${h(under3?.end)} (#${under3?.index ?? '-'})`);
line('shortest run', durations.length ? `${Math.min(...durations.map((d) => d.minutes)).toFixed(1)} min` : '-');

console.log('\nRun lengths in minutes (1..40):');
console.log(`  ${durations.slice(0, 40).map((d) => d.minutes.toFixed(0)).join(' ')}`);

// Rush: from a save at hour H, a fresh run played only to the first diploma.
if (snapshots.size > 0) {
  console.log('\nRush graduation (graduate at the first diploma instead of waiting for the cap), minutes in the fresh run:');
  for (const [at, snap] of snapshots) {
    const state = deserializeState(snap.json, content, snap.now);
    if (!state) continue;
    const before = state.counters.graduations;
    const rush = simulate(content, {
      ...options,
      from: state,
      maxSeconds: snap.seconds + 6 * 3600,
      graduateMinDiplomas: 1,
      graduateGainRatio: 0,
      stopWhenDone: false,
      until: (s) => s.counters.graduations > before,
    });
    const minutes = rush.finalState.counters.graduations > before ? (rush.finalState.lastRun?.seconds ?? Number.NaN) / 60 : Number.NaN;
    console.log(`  save at hour ${at} (taken at ${h(snap.seconds)}, ${before} graduations): ${Number.isNaN(minutes) ? 'did not graduate in 6 h' : `${minutes.toFixed(1)} min`}`);
  }
}
