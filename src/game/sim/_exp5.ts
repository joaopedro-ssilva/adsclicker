import { build } from './_tune';
import { formatDuration, formatNumber } from '../engine/format';
import { simulate } from './simulate';
import { PROFILES } from './profiles';
import type { Params } from './_tune';

const params: Params = JSON.parse(process.argv[2]!);
const minutes = Number(process.argv[3] ?? 10);
const profile = (process.argv[4] ?? 'active') as 'active';
const step = Number(process.argv[5] ?? 30);
const content = build(params);
const r = simulate(content, { ...PROFILES[profile].options, maxSeconds: minutes * 60, stopWhenDone: false, graduate: false, sampleSeconds: step });
for (const t of r.timeline) {
  console.log(`${formatDuration(t.seconds * 1000).padEnd(10)} coins ${formatNumber(t.coins).padEnd(8)} cps ${formatNumber(t.coinsPerSecond).padEnd(8)} clk ${Math.round(t.shares.click * 100)}% auto ${Math.round(t.shares.auto * 100)}% inv ${Math.round(t.shares.invasions * 100)}% spr ${Math.round(t.shares.sprints * 100)}% prof ${t.professors}`);
}
console.log(r.hires.map((h) => `${h.professor} ${formatDuration(h.at * 1000)}`).join(', '));
console.log(JSON.stringify(r.finalState.levels));
