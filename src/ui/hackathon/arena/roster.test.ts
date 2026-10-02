import { describe, expect, it } from 'vitest';
import type { EnemyState } from '@/hackathon/engine';
import { EMPTY_ROSTER, prune, reconcile } from './roster';

const enemy = (uid: number, hp = 10): EnemyState => ({ uid, def: 'bug', hp, maxHp: 10, chargeLandsAt: null });

describe('roster', () => {
  it('places a new wave by index and is stable for the same input', () => {
    const list = [enemy(1), enemy(2)];
    const roster = reconcile(EMPTY_ROSTER, list, 0);
    expect(roster.entries.map((entry) => entry.slot)).toEqual([0, 1]);
    expect(roster.groupSize).toBe(2);
    expect(reconcile(roster, list, 0)).toBe(roster);
  });

  it('keeps a dead enemy as a ghost in its place until pruned', () => {
    const first = reconcile(EMPTY_ROSTER, [enemy(1), enemy(2)], 0);
    const next = reconcile(first, [enemy(2)], 0);
    expect(next.entries.find((entry) => entry.enemy.uid === 1)).toMatchObject({ dying: true, slot: 0 });
    expect(prune(next).entries.map((entry) => entry.enemy.uid)).toEqual([2]);
  });

  it('puts a split child in the first free place, not on top of the dying parent', () => {
    const first = reconcile(EMPTY_ROSTER, [enemy(1)], 0);
    const next = reconcile(first, [enemy(2), enemy(3)], 0);
    const slots = Object.fromEntries(next.entries.map((entry) => [entry.enemy.uid, entry.slot]));
    expect(slots).toEqual({ 1: 0, 2: 1, 3: 2 });
  });

  it('treats an enemy with 0 HP as defeated even while the engine still lists it', () => {
    const first = reconcile(EMPTY_ROSTER, [enemy(1), enemy(2)], 0);
    const next = reconcile(first, [enemy(1, 0), enemy(2)], 0);
    expect(next.entries.find((entry) => entry.enemy.uid === 1)?.dying).toBe(true);
    const pruned = prune(next);
    expect(reconcile(pruned, [enemy(1, 0), enemy(2, 5)], 0).entries.map((entry) => entry.enemy.uid)).toEqual([2]);
  });

  it('starts over on a new wave', () => {
    const first = reconcile(EMPTY_ROSTER, [enemy(1)], 0);
    const next = reconcile(first, [enemy(5), enemy(6), enemy(7)], 1);
    expect(next.entries).toHaveLength(3);
    expect(next.groupSize).toBe(3);
  });
});
