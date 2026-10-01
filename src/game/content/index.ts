import { abilities } from './abilities';
import { achievements } from './achievements';
import { balance } from './balance';
import { clickUpgrades } from './clickUpgrades';
import { disciplines } from './disciplines';
import { invasions } from './invasions';
import { prestigeNodes } from './prestige';
import { professors } from './professors';
import { research } from './research';
import { sceneries } from './sceneries';
import { skins } from './skins';
import { sprints } from './sprints';
import { themes } from './themes';
import type { GameContent } from './types';

export * from './types';

/** Everything the game "has", assembled from one file per kind of content. */
export const content: GameContent = {
  professors,
  disciplines,
  clickUpgrades,
  research,
  abilities,
  invasions,
  sprints,
  prestigeNodes,
  achievements,
  skins,
  sceneries,
  themes,
  balance,
};
