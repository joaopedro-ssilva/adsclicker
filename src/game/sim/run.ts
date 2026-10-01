/**
 * `npm run sim` — plays the real content headless and prints when each pacing milestone of
 * GAME_DESIGN section 7 happens.
 *
 *   npm run sim -- --cps 4 --defend 0.8 --hours 6 --seed 1 --graduate-min 2
 */
import { content } from '@/game/content';
import { formatDuration, formatNumber } from '../engine/format';
import { simulate } from './simulate';
import type { MilestoneResult, SimOptions } from './simulate';

function readArgs(argv: string[]): SimOptions {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) flags.set(key.slice(2), value);
  }
  const number = (name: string): number | undefined => {
    const raw = flags.get(name);
    const parsed = raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const options: SimOptions = {};
  const cps = number('cps');
  const defend = number('defend');
  const hours = number('hours');
  const seed = number('seed');
  const graduateMin = number('graduate-min');
  const graduateRatio = number('graduate-ratio');
  if (cps !== undefined) options.clicksPerSecond = cps;
  if (defend !== undefined) options.defendRate = defend;
  if (hours !== undefined) options.maxSeconds = hours * 3600;
  if (seed !== undefined) options.seed = seed;
  if (graduateMin !== undefined) options.graduateMinDiplomas = graduateMin;
  if (graduateRatio !== undefined) options.graduateGainRatio = graduateRatio;
  if (flags.get('no-graduate') !== undefined || process.argv.includes('--no-graduate')) options.graduate = false;
  return options;
}

/** How the simulated time compares with the target window. */
function verdict(milestone: MilestoneResult): string {
  if (milestone.reachedAt === null) return 'não chegou';
  const { target, reachedAt } = milestone;
  if (!target) return '—';
  if (reachedAt < target.min) return 'cedo demais';
  if (reachedAt > target.max) return 'tarde demais';
  return 'ok';
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function main(): void {
  const options = readArgs(process.argv.slice(2));
  const started = Date.now();
  const result = simulate(content, options);
  const took = Date.now() - started;

  const { options: used } = result;
  console.log(
    `ADSClicker — simulação: ${used.clicksPerSecond} cliques/s, ${Math.round(used.defendRate * 100)}% das invasões defendidas, ` +
      `graduar com ≥ ${used.graduateMinDiplomas} diplomas, semente ${used.seed}`,
  );
  console.log(`Tempo simulado: ${formatDuration(result.seconds * 1000)} (rodou em ${took} ms)\n`);

  console.log(`${pad('Marco', 30)}${pad('Meta', 20)}${pad('Simulado', 14)}Situação`);
  console.log('-'.repeat(78));
  for (const milestone of result.milestones) {
    const at = milestone.reachedAt === null ? '—' : formatDuration(milestone.reachedAt * 1000);
    console.log(`${pad(milestone.label, 30)}${pad(milestone.targetText, 20)}${pad(at, 14)}${verdict(milestone)}`);
  }

  const firstHires = result.hires.filter((hire, i) => result.hires.findIndex((h) => h.professor === hire.professor) === i);
  const hires = firstHires.map((h) => `${content.professors[h.professor].name} ${formatDuration(h.at * 1000)}`);
  console.log(`\nPrimeira contratação: ${hires.join(', ')}`);
  console.log(`Formaturas: ${result.finalState.counters.graduations}, diplomas ganhos: ${formatNumber(result.finalState.diplomasEarned)}`);

  console.log('\nLinha do tempo');
  console.log(`${pad('Tempo', 12)}${pad('Edécoins', 14)}${pad('Edécoins/s', 14)}${pad('Prof.', 8)}${pad('Diplomas', 10)}Conquistas`);
  console.log('-'.repeat(78));
  const every = Math.max(1, Math.round(1800 / used.sampleSeconds));
  result.timeline.forEach((sample, i) => {
    if (i % every !== 0 && i !== result.timeline.length - 1) return;
    console.log(
      pad(formatDuration(sample.seconds * 1000), 12) +
        pad(formatNumber(sample.coins), 14) +
        pad(formatNumber(sample.coinsPerSecond), 14) +
        pad(String(sample.professors), 8) +
        pad(String(sample.diplomasEarned), 10) +
        sample.achievements,
    );
  });
}

main();
