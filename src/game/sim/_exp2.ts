import { content } from '@/game/content';
import { formatDuration, formatNumber } from '../engine/format';
import { simulate } from './simulate';
import { PROFILES } from './profiles';
import { clickValue } from '../engine/views';

const minutes = Number(process.argv[2] ?? 10);
const r = simulate(content, { ...PROFILES.active.options, maxSeconds: minutes * 60, sampleSeconds: 30, graduate: false, stopWhenDone: false });
for (const s of r.timeline) {
  console.log(formatDuration(s.seconds * 1000).padEnd(12), formatNumber(s.coins).padEnd(10), formatNumber(s.coinsPerSecond).padEnd(10), `click ${(s.shares.click * 100).toFixed(0)}% prod ${(s.shares.production * 100).toFixed(0)}% inv ${(s.shares.invasions*100).toFixed(0)}%`);
}
console.log(JSON.stringify(r.finalState.levels));
console.log('click value', formatNumber(clickValue(r.finalState, content)));
console.log(r.hires.map((h) => h.professor + ' ' + h.at).join(', '));
