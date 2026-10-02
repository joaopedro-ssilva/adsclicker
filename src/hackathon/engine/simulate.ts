import type { HackathonContent } from '../content/types';
import { createRun, isValidChoice, stepRun } from './fight';
import type { RunAction, RunOutcome, RunSetup } from './types';

function groupByTick(actions: RunAction[]): Map<number, RunAction[]> {
  const byTick = new Map<number, RunAction[]>();
  for (const action of actions) {
    if (!Number.isInteger(action.tick) || action.tick < 0) continue;
    const list = byTick.get(action.tick) ?? [];
    list.push(action);
    byTick.set(action.tick, list);
  }
  return byTick;
}

/**
 * A whole stage from the recorded actions: `createRun` plus `stepRun` in a loop, exactly what the
 * browser does. A missing choice picks option 0. Always ends: the run caps its own length.
 */
export function simulateRun(setup: RunSetup, actions: RunAction[], content: HackathonContent): RunOutcome {
  const run = createRun(setup, content);
  const byTick = groupByTick(actions);
  const result: { reason: RunOutcome['reason'] | null } = { reason: null };
  let wavesCleared = 0;
  do {
    const tick = run.state.tick;
    const now = byTick.get(tick) ?? [];
    const needsChoice = run.state.phase === 'choosing' && !now.some((a) => isValidChoice(a, tick));
    const events = stepRun(run, needsChoice ? [...now, { tick, kind: 'choice', option: 0 }] : now);
    for (const event of events) {
      if (event.type === 'end') result.reason = event.reason;
      if (event.type === 'waveCleared') wavesCleared += 1;
    }
  } while (run.state.phase === 'fighting' || run.state.phase === 'choosing');
  return {
    won: run.state.phase === 'won',
    reason: result.reason ?? (run.state.phase === 'won' ? 'cleared' : 'defeated'),
    wavesCleared,
    ticks: run.state.tick,
    hpLeft: run.state.player.hp,
  };
}

