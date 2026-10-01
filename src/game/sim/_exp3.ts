import { build } from './_tune';
import { formatDuration } from '../engine/format';
import { simulate } from './simulate';
import { PROFILES } from './profiles';
import type { Params } from './_tune';

const params: Params = JSON.parse(process.argv[2]!);
const content = build(params);
const prof = (process.argv[3] ?? 'angelo') as 'angelo';
for (const M of [1, 2, 4, 8, 16, 32, 100, 1000]) {
  const r = simulate(content, {
    ...PROFILES.active.options,
    maxSeconds: 6 * 3600,
    stopWhenDone: false,
    graduate: false,
    until: (s) => s.hired[prof],
    setup: (s) => { s.diplomasEarned = Math.round((M - 1) / 0.02); },
  });
  const h = Object.fromEntries(r.hires.map((x) => [x.professor, formatDuration(x.at * 1000)]));
  console.log(`M=${M}`, r.finalState.hired[prof] ? formatDuration(r.seconds * 1000) : 'no', JSON.stringify(h));
}
