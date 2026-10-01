import { build } from './_tune';
import { formatDuration, formatNumber } from '../engine/format';
import { simulate } from './simulate';
import { PROFILES } from './profiles';
import type { Params } from './_tune';

const cs = Number(process.argv[2] ?? 0.2);
const h = Number(process.argv[3] ?? 0.5);
const grid: [number, number][] = JSON.parse(process.argv[4]!);
for (const [c, p] of grid) {
  const hire = [1, 2, 3, 4, 5, 6, 7].map((j) => 15 * c ** (3 * j) * h);
  const params: Params = { c, p, hire, clickScale: cs, ml: process.argv[5] ? JSON.parse(process.argv[5]) : undefined };
  const content = build(params);
  const r = simulate(content, { ...PROFILES.active.options, maxSeconds: 5 * 3600, stopWhenDone: false, graduate: false, sampleSeconds: 600, until: (s) => s.hired.angelo });
  let prev = 0;
  const cells = r.hires.map((x) => { const g = x.at - prev; prev = x.at; return `${x.professor.slice(0, 3)} ${formatDuration(x.at * 1000)} (+${Math.round(g / 60)}m)`; });
  console.log(`c=${c} p=${p}:`, cells.join(' | '));
  console.log(r.timeline.map((t) => `${formatDuration(t.seconds * 1000)} cps ${formatNumber(t.coinsPerSecond)} clk ${Math.round(t.shares.click * 100)}% auto ${Math.round(t.shares.auto * 100)}% inv ${Math.round(t.shares.invasions * 100)}% spr ${Math.round(t.shares.sprints * 100)}%`).join('\n'));
  console.log(r.purchases.filter((x) => x.kind === 'hire').map((x) => `${x.id}: cost ${formatNumber(x.cost)} cps ${formatNumber(x.income)} = ${Math.round(x.cost.div(x.income.add(1e-9)).toNumber())}s`).join(' | '));
}
