import type { Reward, SprintGoal } from '@/game/content/types';
import { formatDuration, formatNumber } from '@/game/engine/format';

/** "60 cliques", "3 críticos", "combo 15"... the goal on one short line. */
export function goalText(goal: SprintGoal): string {
  const amount = formatNumber(goal.amount, { integer: true });
  switch (goal.kind) {
    case 'clicks':
      return `${amount} cliques`;
    case 'crits':
      return goal.amount === 1 ? '1 crítico' : `${amount} críticos`;
    case 'reachCombo':
      return `chegar ao combo ${amount}`;
    case 'buyLevels':
      return goal.amount === 1 ? 'comprar 1 nível' : `comprar ${amount} níveis`;
    case 'defendEvents':
      return goal.amount === 1 ? 'defender 1 invasão' : `defender ${amount} invasões`;
    case 'earnSeconds':
      return `ganhar ${formatDuration(goal.amount * 1000)} de produção`;
  }
}

export function rewardLabel(reward: Reward): string {
  return reward.kind === 'coins'
    ? `${formatDuration(reward.seconds * 1000)} de produção`
    : `${reward.buff.emoji} ${reward.buff.name}`;
}
