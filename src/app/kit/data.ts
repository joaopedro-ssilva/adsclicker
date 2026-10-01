import { content } from '@/game/content';
import type { Ambient, ProfessorDef, ProfessorId, SceneryDef, SkinDef } from '@/game/content/types';
import { ASSETS } from '@/ui/art/manifest';
import type { SoundName } from '@/ui/audio';
import type { IconName } from '@/ui/kit';

export const professors: ProfessorDef[] = Object.values(content.professors).sort((a, b) => a.order - b.order);

export const themes = content.themes;

export const hasArt = (key: string | undefined) => key !== undefined && key in ASSETS;

export const realSceneries: SceneryDef[] = content.sceneries.filter((scenery) => hasArt(scenery.asset));
export const proceduralSceneries: SceneryDef[] = content.sceneries.filter((scenery) => !hasArt(scenery.asset));

export const defaultSkin = (id: ProfessorId): SkinDef | undefined =>
  content.skins.find((skin) => skin.professor === id && skin.default);

/** One skin per professor that has no art yet, chosen to show every rarity and several hats. */
const FALLBACK_SKIN_IDS = [
  'edecio-samurai',
  'gladimir-mestre',
  'b2-paleta',
  'wagner-cripto',
  'guto-pagodeiro',
  'b1-rainha',
  'angelo-paraninfo',
  'pablo-mago',
];

export const fallbackSkins: SkinDef[] = FALLBACK_SKIN_IDS.flatMap((id) => content.skins.filter((skin) => skin.id === id));

export const ambients: Ambient[] = ['none', 'dust', 'rain', 'embers', 'stars', 'bubbles', 'code', 'leaves', 'confetti'];

export const ambientLabels: Record<Ambient, string> = {
  none: 'Silêncio',
  dust: 'Poeira',
  rain: 'Chuva',
  embers: 'Brasas',
  stars: 'Estrelas',
  bubbles: 'Bolhas',
  code: 'Código',
  leaves: 'Folhas',
  confetti: 'Confetes',
};

/** Neutral backdrops for the ambient test strip, so each particle type is judged on a fitting colour. */
export const ambientPalettes: Record<Ambient, SceneryDef['palette']> = {
  none: { sky: '#1b2430', horizon: '#475564', floor: '#1b2530' },
  dust: { sky: '#2a2f38', horizon: '#6a6258', floor: '#2c2a2a' },
  rain: { sky: '#101a33', horizon: '#34507a', floor: '#172535' },
  embers: { sky: '#241519', horizon: '#8a3f2a', floor: '#2b1b23' },
  stars: { sky: '#0e1230', horizon: '#3c4169', floor: '#1c1e38' },
  bubbles: { sky: '#103040', horizon: '#3e7e86', floor: '#17404a' },
  code: { sky: '#08201f', horizon: '#2a5a50', floor: '#102824' },
  leaves: { sky: '#20332e', horizon: '#6c8a5a', floor: '#2f3a2c' },
  confetti: { sky: '#2d223c', horizon: '#7a5a82', floor: '#32283f' },
};

export const soundLabels: Record<SoundName, string> = {
  click: 'Clique',
  crit: 'Crítico',
  buy: 'Compra',
  cantAfford: 'Sem saldo',
  milestone: 'Marco',
  achievement: 'Conquista',
  unlock: 'Desbloqueio',
  hire: 'Contratação',
  invasionSpawn: 'Invasão',
  invasionHit: 'Golpe',
  invasionDefended: 'Defendida',
  invasionMissed: 'Perdida',
  ability: 'Habilidade',
  sprintDone: 'Sprint ok',
  sprintFailed: 'Sprint falhou',
  graduate: 'Formatura',
  uiTap: 'Toque',
};

export const iconLabels: Record<IconName, string> = {
  coin: 'Edécoin',
  diploma: 'Diploma',
  click: 'Clique',
  clock: 'Relógio',
  lock: 'Bloqueio',
  check: 'Confirmar',
  star: 'Estrela',
  soundOn: 'Som ligado',
  soundOff: 'Som mudo',
  music: 'Música',
  settings: 'Ajustes',
  book: 'Aulas',
  flask: 'Pesquisa',
  trophy: 'Conquista',
  shirt: 'Roupa',
  image: 'Cenário',
  palette: 'Paleta',
  shield: 'Defesa',
  cloud: 'Nuvem',
  rocket: 'Foguete',
  crown: 'Coroa',
  arrowUp: 'Subir',
  plus: 'Mais',
  x: 'Fechar',
};
