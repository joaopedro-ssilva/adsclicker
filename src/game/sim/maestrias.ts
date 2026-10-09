import type { ProfessorId } from '../content/types';
import * as engine from '../engine/actions';
import { freeSlots, maestriaLevel, maestriaNextCost } from '../engine/maestria';
import { bolsaView, festaView, joinhaView, swarmView } from '../engine/views';
import type { Env } from './strategy';

/** The order a player is likely to pick them: the three of the first wave, then the second wave. */
export const DEFAULT_PICKS: ProfessorId[] = ['edecio', 'gladimir', 'wagner', 'b2', 'guto', 'b1', 'angelo', 'pablo'];

/** After a graduation: puts each new slot on the next built Maestria, then spends leftover diplomas on the cheapest level. */
export function spendMaestrias(env: Env, picks: ProfessorId[] = DEFAULT_PICKS): void {
  const { state, content } = env;
  for (const id of picks) {
    if (freeSlots(state) <= 0) break;
    if (maestriaLevel(state, id) === 0) engine.unlockMaestria(state, content, id, env.now, env.emit);
  }
  for (let guard = 0; guard < 40; guard += 1) {
    let best: { id: ProfessorId; cost: number } | null = null;
    for (const id of picks) {
      const cost = maestriaNextCost(state, content, id);
      if (cost !== null && state.diplomas >= cost && (!best || cost < best.cost)) best = { id, cost };
    }
    if (!best || !engine.buyMaestriaLevel(state, content, best.id, env.now, env.emit)) return;
  }
}

/** Does the player hold the pointer on the professor (Joinha de Ouro level 5)? */
export function holdsPointer(env: Env, clicksPerSecond: number): boolean {
  const view = joinhaView(env.state, env.content);
  return Boolean(view?.canHold) && clicksPerSecond >= 3;
}

/** Fires a full Rollforward and a charged Super invasão. */
export function fireChargedMaestrias(env: Env): void {
  const { state, content } = env;
  while (engine.fireRollforward(state, content, env.now, env.emit)) {
    // spend every stored charge, one after the other
  }
  const swarm = swarmView(state, content, env.now);
  if (swarm?.ready) engine.startSwarm(state, content, env.now, env.emit);
  if (festaView(state, content, env.now)?.ready) engine.startFesta(state, content, env.now, env.emit);
  tradeBolsa(env);
}

/**
 * A simple trader: buys an asset below the low end of its range, sells above the high end. It leaves the Fundo alone: in a run the
 * economy grows faster than the Fundo does, so a player who is buying upgrades is better off not parking coins there.
 */
function tradeBolsa(env: Env): void {
  const { state, content } = env;
  const view = bolsaView(state, content);
  if (!view?.open) return;
  for (const asset of view.assets) {
    if (!asset.open) continue;
    const sellAt = 1 + 0.6 * (asset.hi - 1);
    const buyAt = 1 - 0.4 * (1 - asset.lo);
    if (asset.held && asset.price >= sellAt) engine.sellBolsaAsset(state, content, asset.id, 1, env.now, env.emit);
    else if (!asset.held && asset.price <= buyAt) engine.buyBolsaAsset(state, content, asset.id, 0.5, env.now, env.emit);
  }
}

/** One click on the swarm: the bug about to escape first, the boss when nothing else is left. Returns false with no swarm. */
export function clickSwarm(env: Env): boolean {
  const swarm = env.state.maestria.swarm.active;
  if (!swarm) return false;
  const target = [...swarm.bugs].sort((a, b) => Number(a.boss) - Number(b.boss) || a.expiresAt - b.expiresAt)[0];
  if (target) engine.hitBug(env.state, env.content, target.uid, env.now, env.emit);
  return true;
}
