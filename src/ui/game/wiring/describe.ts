import { content } from '@/game/store';
import type { RewardResult } from '@/game/store';
import type { AchievementDef } from '@/game/content/types';
import { formatDuration, formatNumber } from '@/game/engine/format';

const skinNames = new Map(content.skins.map((skin) => [skin.id, skin.name]));
const sceneryNames = new Map(content.sceneries.map((scenery) => [scenery.id, scenery.name]));
const themeNames = new Map(content.themes.map((theme) => [theme.id, theme.name]));

export const invasionById = new Map(content.invasions.map((def) => [def.id, def]));
export const sprintById = new Map(content.sprints.map((def) => [def.id, def]));

/** "+12,5 K ADScoins" or "⚡ Clique Turbo por 15 s". */
export function rewardText(reward: RewardResult): string {
  return reward.kind === 'coins'
    ? `+${formatNumber(reward.amount, { integer: true })} ADScoins`
    : `${reward.emoji} ${reward.name} por ${formatDuration(reward.durationMs)}`;
}

/** What an achievement gave: the flat production bonus plus any cosmetic. */
export function achievementGrants(def: AchievementDef): string {
  const parts = [`+${Math.round(content.balance.achievementBonus * 100)}% de produção`];
  const { skin, scenery, theme } = def.reward ?? {};
  if (skin) parts.push(`skin ${skinNames.get(skin) ?? skin}`);
  if (scenery) parts.push(`cenário ${sceneryNames.get(scenery) ?? scenery}`);
  if (theme) parts.push(`tema ${themeNames.get(theme) ?? theme}`);
  return parts.join(' · ');
}
