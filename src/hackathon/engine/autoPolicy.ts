import type { ActiveSkillDef } from '../content/types';
import { blockTicks, healAmount } from './skills';

/** What the auto policy looks at: plain numbers, so the simulator's "good player" can reuse it. */
export interface PolicyView {
  tick: number;
  hp: number;
  maxHp: number;
  blockUp: boolean;
  hasteUp: boolean;
  noHealing: boolean;
  /** Skill strength factor (skillPower and the auto penalty). */
  power: number;
  /** Damage of one plain, non-crit hit. */
  hit: number;
  /** Living enemies, in target order. */
  enemies: { hp: number; boss: boolean; chargeLandsAt: number | null }[];
}

/**
 * Auto mode: a ready skill fires at once when it is not wasted.
 *
 * - heal: when at least half of what it would restore is missing (never with `noHealing`);
 * - block: only while a charged hit is winding up and the block would still stand when it lands;
 * - haste: when enemies are alive and a haste is not already running;
 * - aoe: with two or more enemies alive, or against a boss;
 * - strike: when the target would survive a plain hit (no strike on an enemy about to die).
 */
export function shouldUseSkill(def: ActiveSkillDef, view: PolicyView): boolean {
  if (view.enemies.length === 0) return false;
  const effect = def.effect;
  switch (effect.kind) {
    case 'heal': {
      if (view.noHealing) return false;
      const amount = healAmount(view.maxHp, effect.percentOfMaxHp, view.power);
      return amount > 0 && (view.maxHp - view.hp) * 2 >= amount;
    }
    case 'block': {
      if (view.blockUp) return false;
      const duration = blockTicks(effect.durationMs, view.power);
      return view.enemies.some((e) => e.chargeLandsAt !== null && e.chargeLandsAt > view.tick && e.chargeLandsAt - view.tick < duration);
    }
    case 'haste':
      return !view.hasteUp;
    case 'aoe':
      return view.enemies.length >= 2 || view.enemies.some((e) => e.boss);
    case 'strike':
      return (view.enemies[0]?.hp ?? 0) > view.hit;
  }
}
