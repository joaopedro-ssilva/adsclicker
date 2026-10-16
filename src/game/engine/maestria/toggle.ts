import type { GameContent, ProfessorId } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { endFestaNow } from './festa';
import { maestriaLevel } from './slots';
import { endSwarmNow } from './swarm';

/**
 * Switches a Maestria on or off. Off is a pause, not a loss: the level stays, unlocking and buying levels keep working, and
 * the choice stays as the player left it through graduations. Free, allowed at any time. Returns false when nothing changes.
 *
 * Turning off ends what is running: the golden mode stops, the swarm in progress pays what was defeated, the party's buff
 * ends. The Bolsa's holdings stay frozen and untradeable (cashed in only by a graduation). Turning on resumes: every timer
 * is pushed forward by the time spent off, so the pause credits no charge, recharge or market liquidity.
 */
export function setMaestriaEnabled(state: GameState, content: GameContent, professor: ProfessorId, enabled: boolean, now: number, emit: Emit): boolean {
  if (maestriaLevel(state, professor) <= 0) return false;
  const maestria = state.maestria;
  const off = maestria.disabled[professor] === true;
  if (enabled !== off) return false;

  if (!enabled) {
    // End the running effect while the level still counts, then record the pause.
    if (professor === 'edecio' && maestria.joinha.activeUntil > now) maestria.joinha.activeUntil = now;
    else if (professor === 'wagner') endSwarmNow(state, content, emit);
    else if (professor === 'guto') endFestaNow(state);
    maestria.disabled[professor] = true;
    maestria.pausedAt[professor] = now;
  } else {
    const since = maestria.pausedAt[professor] ?? 0;
    const paused = since > 0 ? Math.max(0, now - since) : 0;
    delete maestria.disabled[professor];
    delete maestria.pausedAt[professor];
    resume(state, professor, now, paused, since > 0);
  }
  emit({ type: 'maestriaToggle', professor, enabled });
  return true;
}

function resume(state: GameState, professor: ProfessorId, now: number, paused: number, known: boolean): void {
  const maestria = state.maestria;
  if (professor === 'wagner' && maestria.swarm.since > 0) maestria.swarm.since = known ? maestria.swarm.since + paused : now;
  else if (professor === 'guto' && maestria.festa.since > 0) maestria.festa.since = known ? maestria.festa.since + paused : now;
  else if (professor === 'edecio' && maestria.joinha.readyAt > 0) maestria.joinha.readyAt = known ? maestria.joinha.readyAt + paused : Math.max(maestria.joinha.readyAt, now);
  else if (professor === 'pablo' && maestria.bolsa.at > 0) maestria.bolsa.at = known ? maestria.bolsa.at + paused : now;
}
