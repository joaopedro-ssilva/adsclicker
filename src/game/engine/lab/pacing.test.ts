import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { fullTreeCost, percentile, playBot, playCampaign, treeForBudget } from '../__fixtures__/labBot';
import type { BotResult } from '../__fixtures__/labBot';

// LAB_TUNE='{"run.hpScale":0.2}' overrides content numbers, for what-if sheets (LAB_SIM=1 prints the sheet to LAB_OUT).
for (const [path, value] of Object.entries(JSON.parse(process.env.LAB_TUNE ?? '{}') as Record<string, number>)) {
  const keys = path.split('.');
  let target: Record<string, unknown> = content.lab as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]!] = value;
}

const seeds = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i * 37);
const play = (n: number, tree: Record<string, number>, coins?: string): BotResult[] => seeds(n).map((seed) => playBot(seed, { tree, coins }));
const phases = (results: BotResult[]) => results.map((r) => r.phase);
const rate = (results: BotResult[], bosses: number) => results.filter((r) => r.bosses >= bosses).length / results.length;
const total = fullTreeCost(content);
const EPIC = 3; // rank of 'epico'

describe('pacing (a simulated player, deterministic seeds)', () => {
  const plain = play(400, {});

  it('a first run suffers at the phase-5 boss but can beat it', () => {
    expect(percentile(phases(plain), 0.5)).toBeLessThanOrEqual(6);
    expect(rate(plain, 1)).toBeGreaterThanOrEqual(0.35);
    expect(rate(plain, 1)).toBeLessThanOrEqual(0.55);
  });

  it('beating the phase-10 boss on a first run is rare, and only happens with good items', () => {
    expect(rate(plain, 2)).toBeLessThan(0.03);
    for (const result of plain.filter((r) => r.bosses >= 2)) expect(result.rankAtBoss2 ?? 0).toBeGreaterThanOrEqual(EPIC);
    // the same with a first unlock budget of ADScoins on level ups
    const funded = play(100, {}, '1e25');
    expect(rate(funded, 2)).toBeLessThan(0.1);
    expect(rate(funded, 1)).toBeLessThanOrEqual(0.7);
  }, 120_000);

  it('a quarter of the tree reaches the teens, the full tree goes much deeper, and no run is endless', () => {
    const quarter = play(100, treeForBudget(content, total / 4));
    const full = play(100, treeForBudget(content, total));
    const median = (results: BotResult[]) => percentile(phases(results), 0.5);
    expect(median(quarter)).toBeGreaterThanOrEqual(12);
    expect(median(quarter)).toBeLessThanOrEqual(22);
    expect(median(full)).toBeGreaterThanOrEqual(25);
    expect(median(full)).toBeLessThanOrEqual(35);
    expect(percentile(phases(full), 0.9)).toBeGreaterThanOrEqual(33);
    for (const result of [...plain, ...quarter, ...full]) expect(result.phase).toBeLessThan(80);
    expect(percentile(full.map((r) => r.seconds), 0.5)).toBeGreaterThan(60);
  }, 120_000);

  it('a whole campaign takes 40 to 80 runs to buy the tree', () => {
    const campaign = playCampaign(content);
    expect(campaign.runsToFull).toBeGreaterThanOrEqual(40);
    expect(campaign.runsToFull).toBeLessThanOrEqual(80);
    // the first runs pay a little, the last ones a lot
    expect(campaign.steps[0]!.commits).toBeLessThan(150);
    expect(total).toBeGreaterThan(30_000);
  }, 120_000);
});

describe('pacing sheet', () => {
  it('prints when LAB_SIM is set', () => {
    if (!process.env.LAB_SIM) return;
    const runs = Number(process.env.LAB_RUNS ?? 60);
    const rows: string[] = [];
    const variants: [string, Record<string, number>, string | undefined][] = [
      ['plain', {}, undefined],
      ['plain+coins1e26', {}, '1e26'],
      ['q25', treeForBudget(content, total / 4), undefined],
      ['half', treeForBudget(content, total / 2), undefined],
      ['full', treeForBudget(content, total), undefined],
    ];
    for (const [name, tree, coins] of variants) {
      const results = seeds(runs).map((seed) => playBot(seed, { tree, coins }));
      const p = phases(results);
      rows.push(
        `${name} p10 ${percentile(p, 0.1)} med ${percentile(p, 0.5)} p90 ${percentile(p, 0.9)} max ${Math.max(...p)} boss1 ${(rate(results, 1) * 100).toFixed(0)}% boss2 ${(rate(results, 2) * 100).toFixed(1)}% commits med ${percentile(results.map((r) => r.commits), 0.5)} timer ${((results.filter((r) => r.brokenBy === 'timer').length / runs) * 100).toFixed(0)}% secs med ${percentile(results.map((r) => r.seconds), 0.5).toFixed(0)}`,
      );
    }
    const campaign = playCampaign(content);
    const at = (n: number) => campaign.steps[n - 1];
    rows.push(
      `CAMPAIGN runs to full tree: ${campaign.runsToFull} | ` +
        [1, 2, 5, 10, 20, 30, 40, 50, 60].map((n) => (at(n) ? `run${n}: phase ${at(n)!.phase}, +${at(n)!.commits}, spent ${at(n)!.spent}` : '')).join(' | '),
    );
    writeFileSync(process.env.LAB_OUT ?? 'sim.txt', `TREE TOTAL ${total}\n${rows.join('\n')}\n`);
    expect(rows.length).toBe(6);
  }, 600_000);
});
