import { content } from '@/game/content';
import type { AchievementDef, AchievementFamily } from '@/game/content/types';

type Granted = 'skin' | 'scenery' | 'theme';

const grantedBy: Record<Granted, Map<string, AchievementDef>> = {
  skin: new Map(),
  scenery: new Map(),
  theme: new Map(),
};

for (const achievement of content.achievements) {
  const reward = achievement.reward;
  if (reward?.skin) grantedBy.skin.set(reward.skin, achievement);
  if (reward?.scenery) grantedBy.scenery.set(reward.scenery, achievement);
  if (reward?.theme) grantedBy.theme.set(reward.theme, achievement);
}

/** The achievement that grants a cosmetic (every non-default one has exactly one). */
export function grantingAchievement(kind: Granted, id: string): AchievementDef | undefined {
  return grantedBy[kind].get(id);
}

/** How to get a locked cosmetic, ready to show. Secret achievements never give their condition away. */
export function unlockHint(kind: Granted, id: string): string {
  const achievement = grantingAchievement(kind, id);
  if (!achievement) return 'Recompensa de uma conquista';
  if (achievement.secret) return 'Conquista secreta: ???';
  return `${achievement.name}: ${achievement.description}`;
}

export const FAMILY_LABELS: Record<AchievementFamily, string> = {
  click: 'Cliques',
  production: 'Produção',
  professor: 'Professores',
  events: 'Invasões',
  sprints: 'Sprints',
  graduation: 'Formatura',
  collection: 'Coleção',
  secret: 'Segredos',
};

export const FAMILY_ORDER: AchievementFamily[] = [
  'click',
  'production',
  'professor',
  'events',
  'sprints',
  'graduation',
  'collection',
  'secret',
];
