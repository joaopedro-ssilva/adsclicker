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
 */
export function grantReward(
  state: GameState,
  content: GameContent,
  reward: Reward,
  source: 'invasion' | 'sprint',
  now: number,
  emit: Emit,
): RewardResult {
  const stats = computeStats(state, content);

  if (reward.kind === 'buff') {
    const buff = startBuff(state, reward.buff, source, stats, now, emit);
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
  const amount = Decimal.max(fromProduction, floor).mul(multiplier);
  gain(state, amount);
  return { kind: 'coins', amount };
}
