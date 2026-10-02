import type { ActiveSkillDef, HackathonContent, Modifier } from '../content/types';
import type { PolicyView } from '../engine/autoPolicy';
import { shouldUseSkill } from '../engine/autoPolicy';
import { indexOf } from '../engine/contentIndex';
import { skillPowerFactor } from '../engine/skills';
import type { Run, RunAction } from '../engine/types';

/**
 * - none: no input at all (choices fall back to the first buff).
 * - auto: the run's `auto` flag is on; the engine fires the skills at reduced power.
 * - flow: Flow whenever it is available, no skills (a player who only clicks).
 * - good: Flow on cooldown, skills at full power with the auto policy's sensible timing, and the
 *   buff that looks best.
 */
export type PolicyId = 'none' | 'auto' | 'flow' | 'good';
export const POLICY_IDS: PolicyId[] = ['none', 'auto', 'flow', 'good'];

export interface Policy {
  id: PolicyId;
  /** Sets `RunSetup.auto`. */
  auto: boolean;
  /** The actions to send with the next step. */
  act(run: Run): RunAction[];
}

const STAT_WEIGHT: Record<string, number> = {
  logica: 3,
  agilidade: 3,
  foco: 0.3,
  resiliencia: 1.5,
  atencao: 1.5,
  bossDamage: 1,
  skillPower: 1,
  cooldown: 1,
};

/** Rough value of a buff for the "good" player; negative modifiers count against it. */
function buffScore(modifiers: Modifier[], heal: number, hpShare: number): number {
  let score = heal * (1 - hpShare) * 0.5;
  for (const m of modifiers) {
    const weight = STAT_WEIGHT[m.target] ?? 0.2;
    score += weight * (m.op === 'pct' ? m.value * 1.5 : m.value);
  }
  return score;
}

function chooseBuff(run: Run, content: HackathonContent): RunAction[] {
  const offer = run.state.offer;
  if (!offer) return [];
  const index = indexOf(content);
  const hpShare = run.state.player.hp / run.state.player.maxHp;
  let best = 0;
  let bestScore = -Infinity;
  offer.forEach((id, option) => {
    const buff = index.buffs.get(id);
    const score = buff ? buffScore(buff.modifiers, buff.heal?.percentOfMaxHp ?? 0, hpShare) : -Infinity;
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  });
  return [{ tick: run.state.tick, kind: 'choice', option: best as 0 | 1 | 2 }];
}

function view(run: Run, content: HackathonContent): PolicyView {
  const { state, setup } = run;
  const enemies = indexOf(content).enemies;
  return {
    tick: state.tick,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    blockUp: state.tick < state.player.blockUntil,
    hasteUp: state.tick < state.player.hasteUntil,
    noHealing: setup.stage.modifiers.some((m) => m.noHealing === true),
    power: skillPowerFactor(setup.build.meta, false, content),
    hit: setup.build.stats.logica,
    enemies: state.enemies
      .filter((e) => e.hp > 0)
      .map((e) => ({ hp: e.hp, boss: enemies.get(e.def)?.boss === true, chargeLandsAt: e.chargeLandsAt })),
  };
}

function flowAction(run: Run): RunAction[] {
  const { state } = run;
  const ready = state.phase === 'fighting' && !state.player.flowReady && state.tick >= state.player.flowAvailableAt;
  return ready && state.enemies.some((e) => e.hp > 0) ? [{ tick: state.tick, kind: 'flow' }] : [];
}

function skillActions(run: Run, content: HackathonContent): RunAction[] {
  const actions: RunAction[] = [];
  const skills = indexOf(content).skills;
  for (const skill of run.state.skills) {
    if (run.state.tick < skill.readyAt) continue;
    const def: ActiveSkillDef | undefined = skills.get(skill.id);
    if (def && shouldUseSkill(def, view(run, content))) actions.push({ tick: run.state.tick, kind: 'skill', skill: skill.id });
  }
  return actions;
}

export function createPolicy(id: PolicyId, content: HackathonContent): Policy {
  return {
    id,
    auto: id === 'auto',
    act(run) {
      if (run.state.phase === 'choosing') return id === 'good' ? chooseBuff(run, content) : [];
      if (id === 'flow') return flowAction(run);
      if (id === 'good') return [...flowAction(run), ...skillActions(run, content)];
      return [];
    },
  };
}
