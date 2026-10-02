import type { HackathonContent } from '../content/types';
import { createRun, stepRun } from '../engine/fight';
import { mix32 } from '../engine/rng';
import type { Build, ResolvedStage, RunAction, RunOutcome } from '../engine/types';
import { TICK_MS } from '../engine/types';
import { createPolicy } from './policies';
import type { PolicyId } from './policies';

export interface PlayedRun {
  outcome: RunOutcome;
  /** Every action the policy sent: replaying them with `simulateRun` gives the same outcome. */
  actions: RunAction[];
}

/** Plays one run with a policy, stepping exactly like the browser does. */
export function playRun(build: Build, stage: ResolvedStage, seed: number, policyId: PolicyId, content: HackathonContent): PlayedRun {
  const policy = createPolicy(policyId, content);
  const run = createRun({ seed, build, stage, auto: policy.auto }, content);
  const actions: RunAction[] = [];
  let reason: RunOutcome['reason'] = 'cleared';
  let wavesCleared = 0;
  while (run.state.phase === 'fighting' || run.state.phase === 'choosing') {
    const now = policy.act(run);
    // Like simulateRun: a missing choice means option 0, otherwise time would stay frozen.
    if (run.state.phase === 'choosing' && !now.some((a) => a.kind === 'choice')) {
      now.push({ tick: run.state.tick, kind: 'choice', option: 0 });
    }
    actions.push(...now);
    for (const event of stepRun(run, now)) {
      if (event.type === 'end') reason = event.reason;
      if (event.type === 'waveCleared') wavesCleared += 1;
    }
  }
  const outcome: RunOutcome = {
    won: run.state.phase === 'won',
    reason,
    wavesCleared,
    ticks: run.state.tick,
    hpLeft: run.state.player.hp,
  };
  return { outcome, actions };
}

export interface FightStats {
  runs: number;
  winRate: number;
  /** Seconds of a fight, averaged over all runs / over the won ones. */
  avgSeconds: number;
  avgWinSeconds: number;
  /** Share of max HP left when winning. */
  avgHpLeftShare: number;
  avgWavesCleared: number;
}

export function measureFights(
  build: Build,
  stage: ResolvedStage,
  policyId: PolicyId,
  runs: number,
  content: HackathonContent,
): FightStats {
  let wins = 0;
  let seconds = 0;
  let winSeconds = 0;
  let hpShare = 0;
  let waves = 0;
  for (let i = 0; i < runs; i += 1) {
    const { outcome } = playRun(build, stage, mix32(i + 1), policyId, content);
    const s = (outcome.ticks * TICK_MS) / 1000;
    seconds += s;
    waves += outcome.wavesCleared;
    if (outcome.won) {
      wins += 1;
      winSeconds += s;
      hpShare += outcome.hpLeft / build.stats.foco;
    }
  }
  return {
    runs,
    winRate: wins / runs,
    avgSeconds: seconds / runs,
    avgWinSeconds: wins > 0 ? winSeconds / wins : 0,
    avgHpLeftShare: wins > 0 ? hpShare / wins : 0,
    avgWavesCleared: waves / runs,
  };
}
