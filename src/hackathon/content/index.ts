import { cargos } from './cargos';
import { config } from './config';
import { dailyModifiers } from './dailyModifiers';
import { enemies } from './enemies';
import { heads } from './heads';
import { items, sets } from './items';
import { mentors } from './mentors';
import { rarities } from './rarities';
import { skillNodes } from './skillTree';
import { skills } from './skills';
import { stages } from './stages';
import type { HackathonContent } from './types';
import { waveBuffs } from './waveBuffs';

export type * from './types';

export const hackathonContent: HackathonContent = {
  cargos,
  heads,
  skillNodes,
  skills,
  mentors,
  items,
  sets,
  rarities,
  enemies,
  waveBuffs,
  stages,
  dailyModifiers,
  config,
};
