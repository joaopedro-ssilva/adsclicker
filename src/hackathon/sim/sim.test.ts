import { describe, expect, it } from 'vitest';
import { fixtureContent as content } from '../engine/__fixtures__/content';
import { simulateRun } from '../engine/simulate';
import { resolveStage } from '../engine/stage';
import { buildStudent } from './builds';
import { measureFights, playRun } from './fights';
import { POLICY_IDS } from './policies';
import { simulateProgression } from './progression';
import { bossTable, progressionTable, stageFightTable } from './report';

const boss = resolveStage('boss', '2026-01-01', content)!;

describe('policies', () => {
  const build = buildStudent({ level: 4, gear: 'raro', skills: ['heal', 'aoe'] }, content);

  it.each(POLICY_IDS)('%s: replaying the recorded actions gives the same outcome', (policy) => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const { outcome, actions } = playRun(build, boss, seed, policy, content);
      const replay = simulateRun({ seed, build, stage: boss, auto: policy === 'auto' }, actions, content);
      expect(replay).toEqual(outcome);
    }
  });

  it('a good player does at least as well as one who does nothing', () => {
    const none = measureFights(build, boss, 'none', 60, content);
    const good = measureFights(build, boss, 'good', 60, content);
    expect(good.winRate).toBeGreaterThanOrEqual(none.winRate);
  });
});

describe('fight stats', () => {
  it('are reproducible and bounded', () => {
    const build = buildStudent({ level: 1, gear: null }, content);
    const stage = resolveStage('s1', '2026-01-01', content)!;
    const a = measureFights(build, stage, 'flow', 30, content);
    expect(a).toEqual(measureFights(build, stage, 'flow', 30, content));
    expect(a.winRate).toBeGreaterThan(0.5);
    expect(a.avgWinSeconds).toBeGreaterThan(5);
  });
});

describe('progression', () => {
  it('runs a fresh student through the campaign', () => {
    const report = simulateProgression(content, { students: 6, policy: 'good', maxAttempts: 400, seed: 3 });
    expect(report.stages.map((s) => s.stage.id)).toEqual(['s1', 's2', 's3', 'boss']);
    expect(report.stages[0]?.cleared).toBe(6);
    expect(report.stages[0]?.avgCafesToClear).toBe(1);
    expect(report.avgFinalLevel).toBeGreaterThan(1);
    expect(progressionTable(report)).toContain('s1');
  });
});

describe('reports', () => {
  it('print a table per stage and for the boss', () => {
    expect(stageFightTable(content, 5).split('\n')).toHaveLength(2 + content.stages.length);
    expect(bossTable(content, 5)).toContain('Firewall');
  });
});
