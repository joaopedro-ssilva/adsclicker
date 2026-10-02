import type { HackathonContent } from '../content/types';
import { resolveStage } from '../engine/stage';
import { buildStudent } from './builds';
import type { StudentSpec } from './builds';
import { measureFights } from './fights';
import type { FightStats } from './fights';
import type { PolicyId } from './policies';
import type { ProgressionReport } from './progression';

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const secs = (value: number) => `${value.toFixed(0)}s`;
const cell = (s: FightStats) => `${pct(s.winRate)} ${s.winRate > 0 ? secs(s.avgWinSeconds) : secs(s.avgSeconds) + '*'}`;

/** `win% win-time` per policy ("*" = time of a lost fight, since none was won). */
function fightRow(spec: StudentSpec, stageId: string, policies: PolicyId[], runs: number, content: HackathonContent): string[] {
  const stage = resolveStage(stageId, '2026-01-01', content);
  if (!stage) return policies.map(() => '-');
  const build = buildStudent(spec, content);
  return policies.map((p) => cell(measureFights(build, stage, p, runs, content)));
}

const FIGHT_POLICIES: PolicyId[] = ['none', 'auto', 'flow', 'good'];

/** One row per stage: an on-level student with no items and one with average rare items. */
export function stageFightTable(content: HackathonContent, runs: number): string {
  const rows: string[][] = [];
  for (const stage of content.stages) {
    const level = stage.requiredLevel;
    const bare = fightRow({ level, gear: null }, stage.id, FIGHT_POLICIES, runs, content);
    const rare = fightRow({ level, gear: 'raro', itemLevel: stage.level }, stage.id, FIGHT_POLICIES, runs, content);
    rows.push([stage.id, String(level), ...bare, ...rare]);
  }
  const headers = ['stage', 'lvl', ...FIGHT_POLICIES.map((p) => `bare:${p}`), ...FIGHT_POLICIES.map((p) => `rare:${p}`)];
  return table(headers, rows);
}

/** The boss at the cap level: gear and Firewall (a block skill) with and without good use. */
export function bossTable(content: HackathonContent, runs: number): string {
  const boss = [...content.stages].reverse().find((s) => s.boss);
  if (!boss) return '(no boss stage in the content)';
  const withFirewall = ['firewall', 'deploy'];
  const withoutFirewall = ['deploy', 'cafe-duplo'];
  const specs: { label: string; spec: StudentSpec }[] = [
    { label: 'bare, Firewall + Deploy', spec: { level: 10, gear: null, skills: withFirewall } },
    { label: 'common gear, Firewall + Deploy', spec: { level: 10, gear: 'comum', itemLevel: 8, skills: withFirewall } },
    { label: 'rare gear, Firewall + Deploy', spec: { level: 10, gear: 'raro', itemLevel: 8, skills: withFirewall } },
    { label: 'rare gear, Deploy + Café duplo (no Firewall)', spec: { level: 10, gear: 'raro', itemLevel: 8, skills: withoutFirewall } },
    { label: 'rare gear + mentors 2, Firewall + Deploy', spec: { level: 10, gear: 'raro', itemLevel: 8, mentorLevel: 2, skills: withFirewall } },
    { label: 'epic gear, Firewall + Deploy', spec: { level: 10, gear: 'epico', itemLevel: 8, skills: withFirewall } },
  ];
  const policies: PolicyId[] = ['none', 'flow', 'auto', 'good'];
  const labels: Record<PolicyId, string> = {
    none: 'no input',
    flow: 'flow only (no Firewall)',
    auto: 'auto (Firewall at 80%)',
    good: 'good (Flow + Firewall)',
  };
  const rows = specs.map(({ label, spec }) => [label, ...fightRow(spec, boss.id, policies, runs, content)]);
  return table(['student', ...policies.map((p) => labels[p])], rows);
}

export function progressionTable(report: ProgressionReport): string {
  const regen = 4;
  const rows = report.stages.map((p) => [
    p.stage.id,
    `${p.cleared}/${report.options.students}`,
    p.cleared ? p.avgCafesToClear.toFixed(1) : '-',
    p.cleared ? p.avgAttemptsInStage.toFixed(1) : '-',
    p.cleared ? p.avgLevelAtClear.toFixed(1) : '-',
    p.cleared ? `${Math.max(0, (p.avgCafesToClear - 5) / regen).toFixed(1)}h` : '-',
  ]);
  const head = table(['stage', 'cleared', 'cafes until clear', 'fights in stage', 'level at clear', 'regen wait'], rows);
  return `${head}\n(policy ${report.options.policy}, ${report.options.students} students, average final level ${report.avgFinalLevel.toFixed(1)}; regen wait = Cafes beyond the first 5 at 4 per hour)`;
}
