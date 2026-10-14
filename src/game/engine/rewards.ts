import type { GameContent, Reward } from '../content/types';
import type { Emit, RewardResult } from '../store/types';
import { startBuff } from './buffs';
import { Decimal } from './decimal';
import { clickValueWith, coinsPerSecondWith, gain } from './economy';
import type { GameState } from './state';
import { computeStats } from './stats';

/**
 * Pays a Reward. Coins are `seconds x coinsPerSecond`, with a floor of `rewardClickFloor x
 * clickValue` so early rewards are never zero, times the reward stat of the source.
 *
 * `share` (0..1, default 1) pays only that part: of the coins, or of the buff's duration (an
 * active buff that would last longer is left as it is). Used by the Monitor de Segurança.
 */
export function grantReward(
  state: GameState,
  content: GameContent,
  reward: Reward,
  source: 'invasion' | 'sprint',
  now: number,
  emit: Emit,
  share = 1,
): RewardResult {
  const stats = computeStats(state, content);

  if (reward.kind === 'buff') {
    const shortened = share < 1 ? { ...reward.buff, durationMs: reward.buff.durationMs * share } : reward.buff;
    const running = state.buffs.find((entry) => entry.id === shortened.id);
    if (running && running.endsAt >= now + shortened.durationMs * stats.abilityDuration) {
      return {
        kind: 'buff',
        buffId: running.id,
        name: running.name,
        emoji: running.emoji,
        durationMs: running.endsAt - running.startedAt,
      };
    }
    const buff = startBuff(state, shortened, source, stats, now, emit);
    return {
      kind: 'buff',
      buffId: buff.id,
      name: buff.name,
      emoji: buff.emoji,
      durationMs: buff.endsAt - buff.startedAt,
    };
  }

  const fromProduction = coinsPerSecondWith(state, content, stats).mul(reward.seconds);
  const floor = clickValueWith(state, content, stats).mul(content.balance.rewardClickFloor);
  const multiplier = source === 'invasion' ? stats.eventReward : stats.sprintReward;
  const amount = Decimal.max(fromProduction, floor).mul(multiplier).mul(share);
  gain(state, amount, source === 'invasion' ? 'events' : 'sprints');
  return { kind: 'coins', amount };
}
