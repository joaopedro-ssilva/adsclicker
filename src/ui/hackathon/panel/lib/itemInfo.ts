import type { ItemRarity, SlotId } from '@/hackathon/content';
import type { ItemInstance } from '@/hackathon/engine';
import { itemScore } from '@/hackathon/engine';
import { baseById, HK } from './hk';

export type SortKey = 'raridade' | 'nivel' | 'recentes';

export const SORT_LABEL: Record<SortKey, string> = { raridade: 'Raridade', nivel: 'Nível', recentes: 'Recentes' };

export function itemName(item: ItemInstance): string {
  return baseById.get(item.base)?.name ?? item.base;
}

export function itemSlot(item: ItemInstance): SlotId | null {
  return baseById.get(item.base)?.slot ?? null;
}

export function sortItems(items: readonly ItemInstance[], key: SortKey): ItemInstance[] {
  const copy = [...items];
  if (key === 'nivel') return copy.sort((a, b) => b.level - a.level || itemScore(b, HK) - itemScore(a, HK));
  if (key === 'recentes') return copy.sort((a, b) => b.createdAt - a.createdAt);
  return copy.sort((a, b) => itemScore(b, HK) - itemScore(a, HK) || b.createdAt - a.createdAt);
}

/** Rare and above ask for a confirmation before they are recycled. */
export function needsConfirmation(rarity: ItemRarity): boolean {
  return rarity === 'raro' || rarity === 'epico' || rarity === 'lendario';
}
