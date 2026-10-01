import type { Ambient, SceneryDef } from './types';

type SceneSeed = {
  id: string;
  name: string;
  description: string;
  default?: boolean;
  ambient: Ambient;
  palette: [string, string, string];
  scene: string;
};

const FRAMING =
  '16:9 pixel art background, side view, no characters, clear flat floor area in the lower third of the image where a character stands';

const make = (seed: SceneSeed): SceneryDef => ({
  id: seed.id,
  name: seed.name,
  description: seed.description,
  ...(seed.default ? { default: true } : {}),
  asset: `sceneries/${seed.id}`,
  ambient: seed.ambient,
  palette: { sky: seed.palette[0], horizon: seed.palette[1], floor: seed.palette[2] },
  artPrompt: `${seed.scene}. ${FRAMING}`,
});

/** The closed list of 14 sceneries (GAME_DESIGN section 6). Each non-default one is the reward of exactly one achievement. */
export const sceneries: SceneryDef[] = [
  make({
    id: 'sala-de-aula',
    name: 'Sala de Aula',
    description: 'Quadro branco, projetor e carteiras. Onde tudo começa.',
    default: true,
    ambient: 'dust',
    palette: ['#cfd8e3', '#e8e2d2', '#8d7a5c'],
    scene: 'classroom with a big whiteboard, a ceiling projector and rows of school desks, warm daylight from windows',
  }),
  make({
    id: 'laboratorio',
    name: 'Laboratório de Informática',
    description: 'Fileiras de computadores com monitores acesos. Cheiro de cabo velho e promessa de 10.',
    ambient: 'code',
    palette: ['#0f1a2e', '#1f3a5f', '#3a3f4a'],
    scene: 'computer lab with long rows of desktop computers and glowing monitors showing code, dim blue light',
  }),
  make({
    id: 'academia',
    name: 'Academia Avenida',
    description: 'Halteres, espelhos e muito ferro. O combo precisa de treino.',
    ambient: 'dust',
    palette: ['#2a2a35', '#4a4a5c', '#5a3a2a'],
    scene: 'gym with racks of dumbbells, barbells, mirrors on the walls and rubber floor mats, warm spotlights',
  }),
  make({
    id: 'praia',
    name: 'Prainha',
    description: 'Praia tropical com coqueiros e mar. Home office com vista.',
    ambient: 'leaves',
    palette: ['#7fd4f5', '#3db6c9', '#e8d19a'],
    scene: 'tropical beach with palm trees, calm turquoise sea, white clouds and golden sand, sunny day',
  }),
  make({
    id: 'prisao',
    name: 'Prisão',
    description: 'Cela com grades e luz fria. Aqui dentro só a lógica é livre.',
    ambient: 'dust',
    palette: ['#1c2330', '#3a4556', '#4a4a50'],
    scene: 'prison cell with iron bars, stone walls, a small barred window and cold bluish light',
  }),
  make({
    id: 'nether',
    name: 'Nether',
    description: 'Caverna de lava e blocos escuros. Cuidado onde pisa, aventureiro.',
    ambient: 'embers',
    palette: ['#2a0d0d', '#7a1f12', '#3a1a1a'],
    scene: 'blocky voxel cavern of dark red stone with rivers of glowing lava and floating embers, dark ominous glow',
  }),
  make({
    id: 'casa-automatica',
    name: 'Casa Automática',
    description: 'Sala de casa inteligente com painéis e luzes. Tudo acende, até o clique.',
    ambient: 'none',
    palette: ['#dfe9f2', '#a9c3dc', '#b9a58a'],
    scene: 'modern smart home living room with wall control panels, smart lights, a sofa and glowing sensors, soft white light',
  }),
  make({
    id: 'arena',
    name: 'Arena',
    description: 'Estádio de futebol à noite com a torcida em festa. Gol de placa a cada clique.',
    ambient: 'confetti',
    palette: ['#0b1530', '#1d3a6b', '#2f7a3a'],
    scene: 'football stadium at night with bright floodlights, packed cheering crowd in the stands and a green grass pitch',
  }),
  make({
    id: 'cidade',
    name: 'Cidade',
    description: 'Avenida com arranha-céus à noite e neon. A cidade que nunca para de compilar.',
    ambient: 'rain',
    palette: ['#0b0b24', '#3a1f6b', '#2a2a38'],
    scene: 'rainy night city avenue with tall skyscrapers, neon signs in pink and cyan, wet asphalt reflecting lights',
  }),
  make({
    id: 'deserto',
    name: 'Exílio',
    description: 'Deserto com dunas e sol baixo. Ótimo lugar para pensar (e para não ter sinal).',
    ambient: 'dust',
    palette: ['#f2a65a', '#e07b39', '#c98f4f'],
    scene: 'desert with rolling sand dunes, a low orange sun on the horizon and a few cacti, warm dusty sky',
  }),
  make({
    id: 'templo',
    name: 'Templo',
    description: 'Templo japonês com cerejeiras. Silêncio, pétalas e compilação concluída.',
    ambient: 'leaves',
    palette: ['#f7d6e0', '#e8a5b8', '#8a6a5a'],
    scene: 'Japanese temple with red wooden pillars and curved roofs, blooming cherry blossom trees and falling petals, soft pink sky',
  }),
  make({
    id: 'datacenter',
    name: 'Datacenter',
    description: 'Corredor de racks com LEDs piscando. Aqui mora a nuvem do Guto.',
    ambient: 'code',
    palette: ['#08121c', '#12324a', '#262b33'],
    scene: 'datacenter aisle between tall server racks full of blinking green and blue LEDs, cold blue light, cables overhead',
  }),
  make({
    id: 'coordenacao',
    name: 'Sala da Coordenação',
    description: 'Escritório com mesa, estante e diplomas na parede. A porta está sempre aberta (mas bata).',
    ambient: 'dust',
    palette: ['#d8c9a8', '#a8885c', '#6b4a2f'],
    scene: 'coordinator office with a wooden desk, a bookshelf, framed diplomas on the wall and a green desk lamp, warm light',
  }),
  make({
    id: 'formatura',
    name: 'Formatura',
    description: 'Auditório com palco, cortina e faixa de parabéns. Hora do canudo e das fotos.',
    ambient: 'confetti',
    palette: ['#3a1f4f', '#7a2f5f', '#8a5a3a'],
    scene: 'graduation auditorium with a wide stage, deep red curtains, a congratulations banner and rows of seats, warm spotlights',
  }),
];
