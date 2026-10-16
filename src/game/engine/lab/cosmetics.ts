/**
 * The Laboratório wardrobe: owning, buying and wearing the monitor skins, lab themes, decorations and starting items of
 * content/labCosmetics.ts. All of it is permanent (it survives graduation). Only the starting item touches the game
 * (it takes the Mouse quebrado's place at the start of a run); the rest is looks.
 */
import type { LabCosmeticDef, LabCosmeticKind } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { Decimal, parseDecimal } from '../decimal';
import { spend } from '../economy';
import type { GameState } from '../state';
import type { LabCosmetics } from './types';

const cache = new WeakMap<GameContent, Map<string, LabCosmeticDef>>();

function catalogue(content: GameContent): Map<string, LabCosmeticDef> {
  let map = cache.get(content);
  if (!map) {
    map = new Map(content.lab.cosmetics.items.map((entry) => [entry.id, entry]));
    cache.set(content, map);
  }
  return map;
}

export function labCosmeticDef(content: GameContent, id: string): LabCosmeticDef | undefined {
  return catalogue(content).get(id);
}

/** The cosmetics of one kind, in content order. */
export function labCosmeticsOf(content: GameContent, kind: LabCosmeticKind): LabCosmeticDef[] {
  return content.lab.cosmetics.items.filter((entry) => entry.kind === kind);
}

/** Owned: a free default, or bought, or granted. */
export function labCosmeticOwned(content: GameContent, cosmetics: LabCosmetics, id: string): boolean {
  const def = labCosmeticDef(content, id);
  return Boolean(def && (def.free || cosmetics.owned[id]));
}

/** The price of a cosmetic that is for sale, or null (a default, an achievement reward, or an unknown id). */
export function labCosmeticPrice(content: GameContent, id: string): Decimal | null {
  const price = labCosmeticDef(content, id)?.price;
  return price ? parseDecimal(price) : null;
}

/** Whether the player can buy it now: for sale, not owned, with the coins in hand. */
export function labCosmeticBuyCheck(state: GameState, content: GameContent, id: string): 'ok' | 'owned' | 'not_for_sale' | 'locked' | 'poor' {
  const price = labCosmeticPrice(content, id);
  if (!price) return 'not_for_sale';
  if (labCosmeticOwned(content, state.lab.cosmetics, id)) return 'owned';
  if (!state.lab.unlocked) return 'locked';
  return state.coins.lt(price) ? 'poor' : 'ok';
}

/**
 * Gives a cosmetic without charging for it: an achievement reward (or any later source). Idempotent; false when the id is
 * unknown or already owned. A free default is owned from the start, so granting it does nothing.
 */
export function grantLabCosmetic(state: GameState, content: GameContent, id: string, emit?: Emit): boolean {
  const def = labCosmeticDef(content, id);
  if (!def || def.free || state.lab.cosmetics.owned[id]) return false;
  state.lab.cosmetics.owned[id] = true;
  emit?.({ type: 'labCosmeticGained', id, how: 'grant' });
  return true;
}

/** Buys a cosmetic with ADScoins. It is owned for good. */
export function buyLabCosmetic(state: GameState, content: GameContent, id: string, emit: Emit): boolean {
  if (labCosmeticBuyCheck(state, content, id) !== 'ok') return false;
  const price = labCosmeticPrice(content, id);
  if (!price) return false;
  spend(state, price);
  state.lab.cosmetics.owned[id] = true;
  emit({ type: 'labCosmeticGained', id, how: 'shop' });
  return true;
}

/**
 * Puts an owned cosmetic on. Monitor, theme and starting item replace the one in use; a decoration is added (up to the
 * limit, and false when the display is full). `on = false` takes a decoration off (the single-choice kinds cannot be
 * taken off, only swapped).
 */
export function equipLabCosmetic(state: GameState, content: GameContent, id: string, on = true): boolean {
  const def = labCosmeticDef(content, id);
  const cosmetics = state.lab.cosmetics;
  if (!def || !labCosmeticOwned(content, cosmetics, id)) return false;
  switch (def.kind) {
    case 'monitor':
      if (!on) return false;
      cosmetics.monitor = id;
      return true;
    case 'theme':
      if (!on) return false;
      cosmetics.theme = id;
      return true;
    case 'start':
      if (!on) return false;
      cosmetics.startItem = id;
      return true;
    case 'decor': {
      const at = cosmetics.decor.indexOf(id);
      if (!on) {
        if (at < 0) return false;
        cosmetics.decor.splice(at, 1);
        return true;
      }
      if (at >= 0 || cosmetics.decor.length >= content.lab.cosmetics.decorMax) return false;
      cosmetics.decor.push(id);
      return true;
    }
  }
}

/** The base the next run starts with in the ferramenta slot: the equipped starting item, the Mouse quebrado if it is not valid. */
export function labStarterId(state: GameState, content: GameContent): string {
  const id = state.lab.cosmetics.startItem;
  const def = labCosmeticDef(content, id);
  return def?.kind === 'start' && labCosmeticOwned(content, state.lab.cosmetics, id) ? id : content.lab.starter;
}
