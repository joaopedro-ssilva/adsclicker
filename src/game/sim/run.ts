/**
 * `npm run sim` — plays the real content headless and prints when each pacing milestone of
 * GAME_DESIGN section 7 happens, how the runs shorten after each graduation and where the coins
 * come from.
 *
 *   npm run sim                                   active player, 6 hours
 *   npm run sim -- --profile all --hours 12       the three profiles
 *   npm run sim -- --profile casual --seed 3 --audit
 *
 * Flags: --profile active|casual|idle|all, --cps, --defend, --hours, --seed, --graduate-min,
 * --graduate-ratio, --graduate-until, --no-graduate, --away play,away (seconds), --audit (research
 * table), --sprints (sprint table), --every (timeline step, minutes).
 */
import { content } from '@/game/content';
import { formatDuration } from '../engine/format';
import { PROFILES, PROFILE_IDS } from './profiles';
import type { ProfileId } from './profiles';
import {
  hireTable,
  milestoneTable,
  researchAudit,
  runTable,
  sprintSummary,
  timelineTable,
  treeSummary,
  unreachedAchievements,
} from './report';
import { simulate } from './simulate';
import type { SimOptions } from './simulate';

function readFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    const value = argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) flags.set(key.slice(2), value);
    else flags.set(key.slice(2), 'true');
  }
  return flags;
}

function main(): void {
  const flags = readFlags(process.argv.slice(2));
  const number = (name: string): number | undefined => {
    const raw = flags.get(name);
    const parsed = raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const choice = flags.get('profile') ?? 'active';
  const profileIds: ProfileId[] = choice === 'all' ? PROFILE_IDS : PROFILE_IDS.filter((id) => id === choice);
  if (profileIds.length === 0) {
    console.log(`Perfil desconhecido: ${choice}. Use active, casual, idle ou all.`);
    return;
  }

  for (const id of profileIds) {
    const profile = PROFILES[id];
    const options: SimOptions = { ...profile.options, maxSeconds: (number('hours') ?? 6) * 3600 };
    const cps = number('cps');
    const defend = number('defend');
    const seed = number('seed');
    const graduateMin = number('graduate-min');
    const graduateRatio = number('graduate-ratio');
    const graduateUntil = number('graduate-until');
    if (cps !== undefined) options.clicksPerSecond = cps;
    if (defend !== undefined) options.defendRate = defend;
    if (seed !== undefined) options.seed = seed;
    if (graduateMin !== undefined) options.graduateMinDiplomas = graduateMin;
    if (graduateRatio !== undefined) options.graduateGainRatio = graduateRatio;
    if (graduateUntil !== undefined) options.graduateUntil = graduateUntil;
    if (flags.has('no-graduate')) options.graduate = false;
    const away = flags.get('away');
    if (away) {
      const [play, gone] = away.split(',').map(Number);
      if (play && gone) options.away = { playSeconds: play, awaySeconds: gone };
    }

    const started = Date.now();
    const result = simulate(content, { ...options, stopWhenDone: false });
    const took = Date.now() - started;
    const used = result.options;

    console.log(`\n=== ${profile.label}: ${profile.description} ===`);
    console.log(
      `${used.clicksPerSecond} cliques/s, ${Math.round(used.defendRate * 100)}% das invasões, graduar com ≥ ${used.graduateMinDiplomas} diplomas ` +
        `e ≥ ${Math.round(used.graduateGainRatio * 100)}% do acumulado, semente ${used.seed}`,
    );
    console.log(`Tempo simulado: ${formatDuration(result.seconds * 1000)} (rodou em ${took} ms)\n`);

    console.log(milestoneTable(result).join('\n'));
    console.log('\nContratações por corrida (tempo desde o início da corrida, e o intervalo desde a anterior)');
    console.log(hireTable(result, content).join('\n'));
    console.log('\nCorridas');
    console.log(runTable(result).join('\n'));
    console.log(`\n${treeSummary(result, content).join('\n')}`);
    console.log('\nLinha do tempo (de onde vem a renda)');
    console.log(timelineTable(result, (number('every') ?? 30) * 60).join('\n'));

    const missing = unreachedAchievements(result, content);
    console.log(`\nConquistas não alcançadas: ${missing.length === 0 ? 'nenhuma' : `${missing.length}`}`);
    if (missing.length > 0 && missing.length <= 40) console.log(missing.join('\n'));

    if (flags.has('sprints')) console.log(`\n${sprintSummary(result, content).join('\n')}`);
    if (flags.has('audit')) console.log(`\n${researchAudit(result, content).join('\n')}`);
  }
}

main();
