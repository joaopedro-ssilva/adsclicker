import type { ActiveSkillDef, HackathonContent, MetaId } from '../content/types';
import { damageEnemy, msToTicks } from './enemies';
import type { FightEvent } from './types';
import { livingEnemies } from './runtime';
import type { Sim } from './runtime';

/** Strength of a skill: the skillPower meta, times the auto-mode penalty when it fires by itself. */
export function skillPowerFactor(meta: Record<MetaId, number>, auto: boolean, content: HackathonContent): number {
  return (1 + meta.skillPower / 100) * (auto ? content.config.autoSkillPower : 1);
}

export function cooldownTicks(def: ActiveSkillDef, meta: Record<MetaId, number>): number {
  return Math.max(1, Math.round((def.cooldownMs / 100) * ((100 - meta.cooldown) / 100)));
}

export function healAmount(maxHp: number, percentOfMaxHp: number, power: number): number {
  return Math.floor((maxHp * percentOfMaxHp * power) / 100);
}

export function blockTicks(durationMs: number, power: number): number {
  return msToTicks(durationMs * power);
}

export function healPlayer(sim: Sim, amount: number, events: FightEvent[]): void {
  if (sim.noHealing || amount <= 0) return;
  const healed = Math.min(sim.maxHp - sim.hp, amount);
  if (healed <= 0) return;
  sim.hp += healed;
  events.push({ type: 'heal', amount: healed });
}

function strikeAt(sim: Sim, raw: number, targets: ReturnType<typeof livingEnemies>, events: FightEvent[]): void {
  for (const target of targets) {
    const { damage, killed } = damageEnemy(sim, target, raw, events);
    events.push({ type: 'playerHit', target: target.uid, damage, crit: false, flow: false, killed });
  }
}

/** Fires one equipped skill: puts it on cooldown and applies its effect. */
export function castSkill(sim: Sim, skill: { id: string; readyAt: number }, auto: boolean, events: FightEvent[]): void {
  const def = sim.index.skills.get(skill.id);
  if (!def) return;
  const power = skillPowerFactor(sim.meta, auto, sim.content);
  skill.readyAt = sim.tick + cooldownTicks(def, sim.meta);
  events.push({ type: 'skill', skill: def.id, auto });
  const effect = def.effect;
  switch (effect.kind) {
    case 'heal':
      healPlayer(sim, healAmount(sim.maxHp, effect.percentOfMaxHp, power), events);
      break;
    case 'aoe':
      strikeAt(sim, Math.floor(sim.stats.logica * effect.hitMultiplier * power), livingEnemies(sim), events);
      break;
    case 'strike':
      strikeAt(sim, Math.floor(sim.stats.logica * effect.hitMultiplier * power), livingEnemies(sim).slice(0, 1), events);
      break;
    case 'block':
      sim.blockUntil = sim.tick + blockTicks(effect.durationMs, power);
      break;
    case 'haste':
      sim.hasteMultiplier = 1 + (effect.attackSpeedMultiplier - 1) * power;
      sim.hasteUntil = sim.tick + msToTicks(effect.durationMs);
      break;
  }
}
