/**
 * `npx tsx src/hackathon/sim/run.ts`: balance tables for the Hackathon mode.
 *
 *   npx tsx src/hackathon/sim/run.ts                  fights + boss + progression
 *   npx tsx src/hackathon/sim/run.ts --only fights    fights | boss | progression
 *   npx tsx src/hackathon/sim/run.ts --runs 300 --students 30 --policy good --max-cafes 3000 --seed 1
 *
 * Uses the real content; when that is still the empty placeholder it says so and runs on the
 * engine's test fixture instead.
 */
import { hackathonContent } from '../content';
import type { HackathonContent } from '../content/types';
import { fixtureContent } from '../engine/__fixtures__/content';
import { POLICY_IDS } from './policies';
import type { PolicyId } from './policies';
import { simulateProgression } from './progression';
import { bossTable, progressionTable, stageFightTable } from './report';

function flags(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    const next = argv[i + 1];
    out.set(key.slice(2), next !== undefined && !next.startsWith('--') ? next : 'true');
  }
  return out;
}

function main(): void {
  const f = flags(process.argv.slice(2));
  const num = (name: string, fallback: number) => (Number.isFinite(Number(f.get(name))) && f.has(name) ? Number(f.get(name)) : fallback);
  const only = f.get('only');
  const policy = (POLICY_IDS as string[]).includes(f.get('policy') ?? '') ? (f.get('policy') as PolicyId) : 'good';

  const placeholder = hackathonContent.stages.length === 0 || hackathonContent.enemies.length === 0;
  const content: HackathonContent = placeholder ? fixtureContent : hackathonContent;
  if (placeholder) {
    console.log('!! The Hackathon content is still the empty placeholder: showing the engine test fixture instead.\n');
  }

  if (!only || only === 'fights') {
    console.log('Fights: on-level student (level = required level), "win% win-time" ("*": time of a lost fight)\n');
    console.log(stageFightTable(content, num('runs', 100)), '\n');
  }
  if (!only || only === 'boss') {
    console.log('Boss at level 10\n');
    console.log(bossTable(content, num('runs', 100)), '\n');
  }
  if (!only || only === 'progression') {
    console.log('Progression: a fresh student farming the campaign\n');
    const report = simulateProgression(content, {
      students: num('students', 20),
      policy,
      maxAttempts: num('max-cafes', 3000),
      seed: num('seed', 1),
    });
    console.log(progressionTable(report));
  }
}

main();
