// Builds the generation queue: art/queue/NN-<label>.txt (one Codex call each, max 2 images) and
// registers every expected sheet in art/sheets.json. Run again any time: it is idempotent.
//   node scripts/art/queue.mjs
// Then run the queue with: bash art/run-queue.sh   (sequential, stops at the first usage-limit error)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, SHEETS_FILE, readJson, writeJson } from './lib.mjs';

const QUEUE_DIR = path.join(ROOT, 'art', 'queue');
const RAW_DIR = path.join(ROOT, 'art', 'raw');
const HEADS_DIR = path.join(ROOT, 'public', 'assets', 'heads');

const BASE =
  'a pixel-art sprite sheet, 16-bit SNES style, crisp chunky pixels, limited palette, dark 1px outline, flat solid pure magenta (#FF00FF) background with nothing else on it';
const PREFIX =
  'Use your built-in image generation tool (not code, not SVG) to create exactly {N} PNG image{S} and save {THEM} in the current working directory. Do not try to fix or edit the background colour afterwards, just save what the tool gives you.';
const SUFFIX =
  'After generating, copy the files into the current directory with those exact names and print their paths and pixel dimensions. Do not do anything else.';
const BODY_RULES =
  'Each body ends at a short neck stub at the top (the neck stub is bare light tan skin) - NO head, NO face, NO hair, NO hat, NO helmet. Tiny cute chibi proportions (short body, small arms and legs), front view, standing, held items stay close to the body. Bodies are well spaced, not touching, all the same size.';

/** Sprites redrawn in a later sheet: the old sheet skips them (a key starting with "_" is never written). */
const REDRAWN = new Set([
  'edecio', 'gladimir', 'guto', 'b2', 'angelo', 'pablo',
  'guto-default', 'guto-churrasqueiro', 'guto-pagodeiro', 'guto-dj', 'guto-astronauta',
  'pablo-galactico',
]);
const kept = (keys) => keys.map((key) => (REDRAWN.has(key) ? `_${key}` : key));

const letters = 'abcdefghijkl';
const list = (items) => items.map((t, i) => `(${letters[i]}) ${t}`).join('; ');

// ---- data ---------------------------------------------------------------------------------

const SKINS = [
  ['edecio-cafe', 'barista apron over a shirt, holding a steaming coffee mug'],
  ['edecio-programador', 'black hooded sweatshirt with the hood down around the neck stub, a laptop under one arm'],
  ['edecio-chad', 'sleeveless tank top, big muscular arms, holding a dumbbell'],
  ['edecio-cria', 'soccer team jersey, gold chain necklace, baggy shorts and flip-flops'],
  ['edecio-prisioneiro', 'orange prison jumpsuit with an open loose handcuff on one wrist'],
  ['edecio-atleta', 'soccer uniform kit with a soccer ball at the foot'],
  ['edecio-full-dima', 'blocky voxel-style diamond-blue armor, holding a blocky voxel sword'],
  ['edecio-ceo', 'dark business suit with a red tie, holding a briefcase'],
  ['edecio-gladiador', 'Roman armor with a red cape, holding a short gladius sword'],
  ['edecio-samurai', 'teal-blue samurai armor holding a katana'],
  ['gladimir-dba', 'work vest, a network cable over the shoulder, holding a coffee mug'],
  ['gladimir-maker', 'lab coat covered in small sensors and colorful LEDs, holding a breadboard'],
  ['gladimir-piloto', 'orange space-pilot jumpsuit with a white vest'],
  ['gladimir-mestre', 'beige space-knight tunic, holding a glowing blue energy sword'],
  ['b2-postit', 'outfit covered in colorful sticky notes, holding a pen'],
  ['b2-wireframe', 'grey outfit with wireframe boxes and X marks drawn on it'],
  ['b2-darkmode', 'all-black outfit with neon purple details'],
  ['b2-paleta', 'rainbow gradient dress, holding a giant paintbrush'],
  ['wagner-hacker', 'hooded sweatshirt with green code patterns, hood down, holding a laptop'],
  ['wagner-agente', 'black suit with a thin tie and a coiled earpiece cable'],
  ['wagner-firewall', 'brick-wall armor with orange flames'],
  ['wagner-cripto', 'silver armor with a padlock emblem on the chest, holding a shield with a key emblem'],
  ['guto-churrasqueiro', 'apron, a barbecue skewer in one hand, a cloth over the shoulder'],
  ['guto-pagodeiro', 'open shirt, holding a tambourine'],
  ['guto-dj', 'neon jacket, headphones hanging on the chest, holding a small DJ controller'],
  ['guto-astronauta', 'white space suit with blue cloud patterns'],
  ['b1-po', 'blazer, a kanban board under one arm'],
  ['b1-flexbox', 'outfit made of aligned colorful blocks'],
  ['b1-lancamento', 'purple astronaut jumpsuit with a small rocket on the back'],
  ['b1-rainha', 'purple dress with a cape, holding a scepter shaped like curly braces { }'],
  ['angelo-terno', 'complete suit, holding a document briefcase'],
  ['angelo-maestro', 'tailcoat, holding a conductor baton'],
  ['angelo-paraninfo', 'black graduation gown with an amber sash, holding a rolled diploma'],
  ['angelo-rei', 'red royal robe with white ermine trim, holding a scepter'],
  ['pablo-cientista', 'white lab coat, holding a clipboard'],
  ['pablo-enxadrista', 'chess-pattern vest, holding a chess king piece'],
  ['pablo-mago', 'blue robe with stars, holding a staff topped with a binary tree'],
  ['pablo-galactico', 'shimmering cosmic outfit with a star aura'],
];

const SCENERIES = [
  ['sala-de-aula', 'a classroom with a whiteboard on the back wall, a ceiling projector, and rows of school desks'],
  ['laboratorio', 'a computer lab with rows of desks and computers, glowing monitors showing code'],
  ['academia', 'a gym with dumbbell racks, barbells and wall mirrors'],
  ['praia', 'a tropical beach with palm trees, sand and the sea under a bright sky'],
  ['prisao', 'a prison cell with iron bars, a bunk bed and cold blue light'],
  ['nether', 'a cave of lava and dark blocky stone, glowing orange lava pools, ominous red light'],
  ['casa-automatica', 'a smart-home living room with wall panels, ambient lights and a sofa'],
  ['arena', 'a football stadium at night with a cheering crowd, floodlights and a green pitch'],
  ['cidade', 'a night avenue with skyscrapers and neon signs, wet street'],
  ['deserto', 'a desert with sand dunes and a low sun, warm orange sky'],
  ['templo', 'a Japanese temple with blooming cherry trees and a stone path'],
  ['datacenter', 'a datacenter corridor with server racks and blinking LEDs'],
  ['coordenacao', 'an office with a desk, a bookshelf and framed diplomas on the wall'],
  ['formatura', 'a graduation auditorium with a stage, a curtain and a banner'],
  ['cantina', 'a college cafeteria with a snack counter, a glass display of pastries, a coffee machine and plastic tables and chairs'],
  ['biblioteca', 'a quiet library with tall wooden bookshelves, reading lamps and a ladder'],
  ['quadra-de-padel', 'an indoor padel court at night with glass walls, a net, blue turf and bright floodlights'],
  ['madrugada', 'a dark computer lab late at night, lights off, lit only by glowing monitors and a moonlit window'],
  ['orla', 'a lakeside promenade at sunset with an orange sky reflected on calm water, a walkway with railings and an old brick power-plant chimney in the distance'],
  ['servidor-antigo', 'a vintage mainframe computer room with tall cabinets of blinking lights, tape reels and a raised tile floor'],
  ['feira', 'a technology fair hall with colourful exhibition booths, banners without text and hanging lights'],
  ['estudio', 'a podcast studio with acoustic foam walls, microphones on boom arms, a mixing desk and a glowing red sign without text'],
  ['espaco', 'the inside of an orbital space station with a big round window showing planet Earth and stars, panels with small lights'],
  ['trofeus', 'a trophy hall with illuminated glass cabinets full of golden cups and a red carpet'],
  ['jardim', 'a college campus garden in spring with big leafy trees, flower beds, a stone bench and a brick building in the background'],
  ['grafica', 'a print shop with big printers spitting out stacks of rolled diplomas, paper piles and conveyor belts'],
  ['por-do-sol', 'a college campus courtyard at sunset with long shadows, an orange and pink sky, lamp posts turning on and a clock tower'],
  ['neve', 'a snowy college campus in winter with snow-covered pine trees, falling snowflakes, a frozen fountain and cold blue light'],
  ['castelo', 'a wide green medieval meadow with a grand stone castle with towers and flying banners in the background, a dirt path and a blue sky with clouds, fantasy RPG style'],
  ['masmorra', 'a fantasy RPG dungeon corridor with stone brick walls, lit torches, iron chains and a wooden treasure chest'],
];

/** Skins whose head wears something: the professor's head is redrawn with the headgear on, per skin. */
const HEAD_VARIANTS = {
  edecio: [
    ['edecio-cria', 'a flat-brim baseball cap'],
    ['edecio-full-dima', 'a blocky voxel-style diamond-blue helmet that leaves the face open'],
    ['edecio-gladiador', 'a Roman gladiator helmet with a red crest, face open'],
    ['edecio-samurai', 'a dark teal samurai kabuto helmet with golden horns, face open'],
  ],
  gladimir: [
    ['gladimir-maker', 'clear safety goggles pushed up on the forehead'],
    ['gladimir-piloto', 'a white and orange space-pilot helmet with the visor up, face open'],
    ['gladimir-mestre', 'a brown cloth hood up over the hair'],
  ],
  wagner: [
    ['wagner-agente', 'dark sunglasses and a spiral earpiece'],
    ['wagner-cripto', 'an open-face silver knight helmet'],
  ],
  guto: [
    ['guto-pagodeiro', 'a panama straw hat'],
    ['guto-astronauta', 'a white astronaut helmet with a clear glass visor, face visible through it'],
  ],
  b1: [['b1-rainha', 'a golden crown with purple jewels']],
  angelo: [
    ['angelo-paraninfo', 'a black graduation mortarboard cap with an amber tassel'],
    ['angelo-rei', 'a royal golden crown with red velvet'],
    ['angelo-padel', 'a white sports visor cap'],
  ],
  pablo: [
    ['pablo-mago', 'a tall blue wizard hat with yellow stars'],
    ['pablo-galactico', 'the deep hood of a dark charcoal archmage robe with thin silver trim, hood up, face fully visible'],
  ],
};

// ---- builders -----------------------------------------------------------------------------

const calls = []; // { label, images: [{file, kind, keys, text}] }
const sheets = [];

function skinSheet(file, items) {
  return {
    file,
    kind: 'skin',
    keys: kept(items.map((i) => i[0])),
    text: `${BASE}. It shows ${items.length} separate HEADLESS chibi character bodies in a single row. ${BODY_RULES} Outfits left to right: ${list(items.map((i) => i[1]))}.`,
  };
}

// 1) heads: already generated (heads-1.png, heads-2.png) -> only registered
sheets.push({ file: 'heads-1.png', kind: 'head', keys: kept(['edecio', 'gladimir', 'b2', 'wagner']) });
sheets.push({ file: 'heads-2.png', kind: 'head', keys: kept(['guto', 'b1', 'angelo', 'pablo']) });

// 2) default skins (already generated by the first skin call) -> registered
sheets.push({ file: 'skins-1.png', kind: 'skin', keys: ['edecio-default', 'gladimir-default', 'b2-default', 'wagner-default'] });
sheets.push({ file: 'skins-2.png', kind: 'skin', keys: kept(['guto-default', 'b1-default', 'angelo-default', 'pablo-default']) });

// 3) sceneries, 2 per call
for (let i = 0; i < SCENERIES.length; i += 2) {
  const pair = SCENERIES.slice(i, i + 2);
  calls.push({
    label: `sceneries-${i / 2 + 1}`,
    images: pair.map(([id, desc]) => ({
      file: `scenery-${id}.png`,
      kind: 'scenery',
      keys: [id],
      text: `a wide 16:9 landscape pixel-art game background, 16-bit SNES style, crisp chunky pixels, limited palette, no characters, no people, no text, no UI. Side view scene: ${desc}. There is a clear, flat, uncluttered floor area in the lower third of the image where a character will stand; the details of the scene stay in the upper two thirds and at the sides.`,
    })),
  });
}

// 4) the other skins, 4 per sheet, 2 sheets per call, professor order
const skinSheets = [];
for (let i = 0; i < SKINS.length; i += 4) skinSheets.push(SKINS.slice(i, i + 4));
const skinCalls = [];
for (let i = 0; i < skinSheets.length; i += 2) {
  skinCalls.push({
    label: `skins-more-${i / 2 + 1}`,
    images: skinSheets.slice(i, i + 2).map((items, k) => skinSheet(`skins-more-${i + k + 1}.png`, items)),
  });
}

// 5) heads wearing each skin's headgear. The row starts with the plain head as a size reference
//    ("_ref", used by process.mjs to keep the pixel scale and then discarded).
function headVariantSheet(professor) {
  const items = HEAD_VARIANTS[professor];
  return {
    file: `heads-skin-${professor}.png`,
    kind: 'head',
    keys: ['_ref', ...items.map((i) => i[0])],
    calibrate: true,
    sheet: { ref: professor },
    // For the API generator: the reference head travels with the request.
    refs: [`ref-head-${professor}.png`],
    text: `${BASE}. First open the reference image ref-head-${professor}.png in the current directory: it is this character's head. Draw that SAME character's head ${items.length + 1} times in a single row, well spaced, not touching, front view, all exactly the same size: same face, same skin tone, same hair colour, same expression, same chunky pixel style and outline; big chibi heads only, no neck, no body. The first head on the left is plain, exactly like the reference. Each of the others wears different headgear, drawn as part of the head, with the face fully visible. Left to right after the plain one: ${list(items.map((i) => i[1]))}.`,
  };
}
const headCall = (...professors) => ({ label: `heads-skin-${professors.join('-')}`, images: professors.map(headVariantSheet) });

const iconsCall = {
  label: 'icons',
  images: [
    {
      file: 'icons.png',
      kind: 'icon',
      keys: ['coin', 'diploma'],
      text: `${BASE}. It shows 2 separate chunky game icons in a single row, well spaced, not touching, front view, bold simple shapes with a thick dark outline: (a) a shiny gold coin with a large letter "A" on it; (b) a rolled diploma scroll tied with a red ribbon.`,
    },
  ],
};

// Order = priority: the heads with headgear (the owner asked for them first), then the bodies
// that are still missing.
calls.push(
  ...skinCalls.slice(0, 2),
  headCall('edecio', 'gladimir'),
  headCall('wagner', 'guto'),
  headCall('b1', 'angelo'),
  headCall('pablo'),
  ...skinCalls.slice(2),
  iconsCall,
);

// 6) Hackathon mode art (API generator; refs travel with the request from art/raw).
//    Extra sheet fields read by process.mjs: folder (output folder under public/assets), layout (items per
//    row, top to bottom), target ({axis,size}) and sizes (per-key size override).
const HK_STYLE =
  'Match the pixel-art style of the reference image exactly: same chunky 16-bit pixels, same thick dark outline, same shading and palette richness.';
const HK_BASE = BASE.replace(
  'flat solid pure magenta (#FF00FF) background with nothing else on it',
  'flat solid pure magenta (#FF00FF) background with nothing else on it, no text, no labels, no frames, no drop shadows',
);

const HK_HEADS = [
  ['cacheado', 'masculine, tan skin, short curly dark hair'],
  ['oculos-redondos', 'masculine, light skin, messy brown hair, round glasses'],
  ['topete', 'masculine, medium skin, high black quiff'],
  ['black-power', 'masculine, dark skin, rounded black afro'],
  ['barba-ruiva', 'masculine, pale skin, red hair and a full red beard'],
  ['raspado', 'masculine, brown skin, shaved head, light stubble'],
  ['trancas', 'feminine, dark skin, long black braids'],
  ['coque', 'feminine, light skin, blonde hair in a high bun'],
  ['franja-oculos', 'feminine, medium skin, black hair with bangs, square glasses'],
  ['cabelo-rosa', 'feminine, light skin, short bright pink hair'],
  ['cacho-longo', 'feminine, tan skin, long loose brown curls'],
  ['chanel', 'feminine, brown skin, sleek black bob haircut'],
];
const hkHeadSheet = (file, items) => ({
  file,
  kind: 'head',
  keys: items.map((i) => i[0]),
  refs: ['heads-1.png'],
  sheet: { folder: 'hackathon/heads', shareScale: true },
  text: `${HK_BASE}. ${HK_STYLE} It shows ${items.length} different invented young students' heads in a single row, well spaced, not touching, front view, all exactly the same size, friendly smiling expressions, big chibi heads with the same proportions as the heads in the reference image, heads only, no neck, no body, no shoulders. Every head is a different person (do not copy the faces of the reference). Left to right: ${list(items.map((i) => i[1]))}.`,
});

const HK_BODIES = [
  ['estudante', 'a casual teal hoodie and blue jeans with sneakers, with a backpack strap over one shoulder'],
  ['estagiario', 'a smart-casual polo shirt with a company lanyard and ID badge around the neck stub, chinos and clean shoes'],
];
const hkBodySheet = {
  file: 'hk-bodies.png',
  kind: 'skin',
  keys: HK_BODIES.map((b) => b[0]),
  refs: ['skins-1.png'],
  sheet: { folder: 'hackathon/bodies' },
  text: `${HK_BASE}. ${HK_STYLE} It shows 2 separate HEADLESS chibi character bodies in a single row. ${BODY_RULES.replace('light tan skin', 'medium tan skin, and so are the hands')} Outfits left to right: ${list(HK_BODIES.map((b) => b[1]))}.`,
};

const HK_ENEMIES_A = [
  ['bug', 'a cute but menacing green beetle with small angry eyes, little antennae and six tiny legs'],
  ['loop-infinito', 'a ring-shaped circular arrow chasing its own tail, with dizzy spiral swirl eyes, the arrow in warm orange and teal (no purple, no pink)'],
  ['vazamento-de-memoria', 'a blue gooey blob dripping drops, with a gold memory-chip pin pattern on its body, mean eyes'],
  ['codigo-legado', 'a dusty grey old floppy-disk and paper-scroll monster covered in cobwebs and cracks, grumpy tired eyes'],
];
const HK_ENEMIES_B = [
  ['conflito-de-merge', 'a round creature split down the middle by a jagged lightning-like line, left half red and right half blue, one angry eye on each side'],
  ['bug-de-merge', 'a TINY little bug split in half, left half red and right half blue, drawn about one third the size of the other creatures'],
  ['deploy-de-sexta', 'THE BOSS, HUGE: a giant angry red button on top of a server-rack body on fire with orange flames, a small round clock on the rack showing 17:59, glowing angry eyes; clearly much bigger than the others, about twice as tall as the first creature'],
];
const hkEnemySheet = (file, items, note, sizes) => ({
  file,
  kind: 'skin',
  keys: items.map((i) => i[0]),
  refs: ['icons.png'],
  sheet: { folder: 'hackathon/enemies', noAnchor: true, target: { axis: 'h', size: 44 }, sizes },
  text: `${HK_BASE}. ${HK_STYLE} It shows ${items.length} different cute but menacing little game monsters in a single row, well spaced, not touching, front view, chunky bold shapes, each with a thick dark outline and an expressive face. ${note} Left to right: ${list(items.map((i) => i[1]))}.`,
});

const HK_ITEMS_A = [
  ['teclado-mecanico', 'a mechanical keyboard with colourful RGB-lit keycaps'],
  ['notebook-velho', 'an old beige chunky laptop with a cracked corner and stickers, screen showing a green prompt'],
  ['mouse-vertical', 'a vertical ergonomic computer mouse, grey and orange'],
  ['editor-escuro', 'a small code-editor window in dark mode with coloured code lines, deep blue and purple tones'],
  ['terminal-hacker', 'a black terminal window with a green ">_" prompt and a few green text lines'],
  ['calculadora-cientifica', 'a scientific calculator with many small buttons and a green LCD'],
  ['cadeira-ergonomica', 'an ergonomic office chair on wheels, deep blue and purple tones'],
  ['monitor-ultrawide', 'an ultrawide curved computer monitor on a stand showing colourful code'],
  ['mesa-regulavel', 'a height-adjustable standing desk with a small up-down arrow on its leg'],
  ['luminaria-de-mesa', 'an articulated desk lamp glowing warm yellow'],
  ['ventilador-de-mesa', 'a small desk fan with blue blades'],
  ['nobreak', 'a UPS battery backup box with a green LED and a power plug cable'],
];
const HK_ITEMS_B = [
  ['fone-cancelamento', 'over-ear noise-cancelling headphones, deep blue and purple tones'],
  ['mochila-de-notebook', 'a laptop backpack with pockets and a zipper, grey and teal'],
  ['cracha-do-hackathon', 'an event ID badge on a lanyard with the word "HACKATHON" on it'],
  ['camiseta-do-evento', 'a folded event t-shirt with a simple "</>" print'],
  ['oculos-luz-azul', 'anti blue-light glasses with slightly blue tinted lenses'],
  ['relogio-de-ponto', 'a wall time-clock punch machine with a round clock face and a card slot'],
  ['caneca-termica', 'a thermal coffee mug with a lid and steam, deep blue and purple tones'],
  ['pato-de-borracha', 'a yellow rubber duck'],
  ['adesivo-de-linguagem', 'a round programming-language sticker with "{ }" curly braces on it'],
  ['moeda-de-um-commit', 'a shiny gold coin with a small git-branch symbol on it'],
  ['trevo-de-quatro-folhas', 'a green four-leaf clover'],
  ['suculenta-de-mesa', 'a small succulent plant in a little terracotta pot'],
];
const hkItemSheet = (file, items, note) => ({
  file,
  kind: 'icon',
  keys: items.map((i) => i[0]),
  refs: ['icons.png'],
  sheet: { folder: 'hackathon/items', layout: [6, 6], target: { axis: 'max', size: 28 } },
  text: `${HK_BASE}. ${HK_STYLE} It shows 12 separate chunky game item icons arranged in a clean grid of exactly 2 rows with 6 icons each, with wide empty magenta gaps between all icons and between the two rows, nothing touching, each icon one single object drawn at about the same size, bold simple readable shapes with a thick dark outline. ${note} Row 1 left to right: ${list(items.slice(0, 6).map((i) => i[1]))}. Row 2 left to right: ${list(items.slice(6).map((i) => i[1]))}.`,
});

const hkArena = {
  file: 'hk-arena.png',
  kind: 'scenery',
  keys: ['capitulo-1'],
  refs: ['scenery-laboratorio.png'],
  sheet: { folder: 'hackathon/arenas' },
  text: `a wide 16:9 landscape pixel-art game background, 16-bit SNES style, crisp chunky pixels, limited palette, no characters, no people, no text, no UI. ${HK_STYLE} Side view of a computer lab at night: dark blue and purple room, glowing monitors showing code on desks, tangled cables along the walls and desk edges, coffee cups and energy drinks on the desks, a dark window with a few distant city lights, warm desk lamps. There is a clear, flat, uncluttered floor area in the lower third of the image where the fighters stand; the details of the scene stay in the upper two thirds and at the sides.`,
};

calls.push(
  { label: 'hk-heads-1', images: [hkHeadSheet('hk-heads-1.png', HK_HEADS.slice(0, 6))] },
  { label: 'hk-heads-2', images: [hkHeadSheet('hk-heads-2.png', HK_HEADS.slice(6))] },
  { label: 'hk-bodies', images: [hkBodySheet] },
  { label: 'hk-enemies-1', images: [hkEnemySheet('hk-enemies-1.png', HK_ENEMIES_A, 'All four are about the same size.', {})] },
  { label: 'hk-enemies-2', images: [hkEnemySheet('hk-enemies-2.png', HK_ENEMIES_B, 'The third one (the boss) is much bigger than the first, and the second is tiny.', { 'bug-de-merge': 26, 'deploy-de-sexta': 80 })] },
  { label: 'hk-items-1', images: [hkItemSheet('hk-items-1.png', HK_ITEMS_A, 'The chair and the dark-mode editor share a night-shift palette of deep blue and purple accents.')] },
  { label: 'hk-items-2', images: [hkItemSheet('hk-items-2.png', HK_ITEMS_B, 'The headphones and the mug share a night-shift palette of deep blue and purple accents.')] },
  { label: 'hk-arena', images: [hkArena] },
);

// 7) Second pass on the professors (the owner sent reference photos): six plain heads redrawn from a
//    description of each photo, Guto's bodies with his skin tone, and two new bodies.
const V2_HEADS = [
  ['edecio', 'a man in his fifties, fair skin, short dark-brown hair combed to the side, thin on top but clearly covering the head (NOT bald), clean-shaven, wide warm smile'],
  ['gladimir', 'a man in his forties, light tan skin, very short dark grey buzz-cut hair, black rectangular glasses, clean-shaven, calm closed smile'],
  ['guto', 'a man in his thirties, medium brown skin, very short black buzz-cut hair, short full black beard and moustache, big open smile'],
  ['b2', 'a young woman, fair skin, long wavy bright orange-ginger hair falling past the shoulders, round dark-rimmed glasses, big smile'],
  ['angelo', 'a man in his thirties, fair skin, short light-brown hair brushed up at the front, clean-shaven, wide smile'],
  ['pablo', 'a young man, fair skin, short dark-brown hair with volume on top, thin metal rectangular glasses, a moustache and a small goatee, slight smile'],
];
const v2HeadSheet = (file, items) => ({
  file,
  kind: 'head',
  keys: items.map((i) => i[0]),
  refs: ['heads-1.png'],
  sheet: { shareScale: true },
  text: `${HK_BASE}. ${HK_STYLE} It shows ${items.length} different invented cartoon characters' heads in a single row, well spaced, not touching, front view, all exactly the same size, big chibi heads with the same proportions, face size and friendly look as the heads in the reference image, heads only, no neck, no body, no shoulders. Do not copy the faces of the reference. Left to right: ${list(items.map((i) => i[1]))}.`,
});
// The first redraw gave Angelo a tall quiff; the owner asked for less hair. Same row, only the middle head changes.
const angeloHead = {
  file: 'heads-v2-angelo.png',
  kind: 'head',
  keys: ['_b2', 'angelo', '_pablo'],
  refs: ['heads-v2-2.png'],
  sheet: { shareScale: true },
  text: `${HK_BASE} Redraw the reference image: the same three heads, same size, same positions, same pixel-art style. The left and right heads stay exactly as they are. Change only the middle head's hair: the same man, same face, but with SHORT, LOW, NEAT light-brown hair lying close to the scalp, a simple short haircut with a slightly receding hairline, no quiff, no spikes, no volume on top; the top of his head is clearly lower than before.`,
};
// The owner asked for Edécio's hair a little whiter. Same row, only the left head changes.
const edecioHead = {
  file: 'heads-v2-edecio.png',
  kind: 'head',
  keys: ['edecio', '_gladimir', '_guto'],
  refs: ['heads-v2-1.png'],
  sheet: { shareScale: true },
  text: `${HK_BASE} Redraw the reference image: the same three heads, same size, same positions, same pixel-art style. The middle and right heads stay exactly as they are. Change only the left head's hair colour: the same man, same face, same haircut and hair shape, but his hair is now salt-and-pepper, greying brown with clearly grey-white sides and temples and light grey streaks on top (a man in his late fifties going grey, not fully white).`,
};
// Gladimir came out too dark next to his fair bodies. Same row, only the middle head changes.
const gladimirHead = {
  file: 'heads-v2-gladimir.png',
  kind: 'head',
  keys: ['_edecio', 'gladimir', '_guto'],
  refs: ['heads-v2-1.png'],
  sheet: { shareScale: true },
  text: `${HK_BASE} Redraw the reference image: the same three heads, same size, same positions, same pixel-art style. The left and right heads stay exactly as they are. Change only the middle head's skin colour: the same man, same face, same glasses, same very short grey hair, but his skin is now FAIR and light, the same light peach skin tone as the head on the left.`,
};
const gutoBodies = {
  file: 'skins-guto.png',
  kind: 'skin',
  keys: ['guto-default', 'guto-churrasqueiro', 'guto-pagodeiro', 'guto-dj', 'guto-astronauta'],
  refs: ['skins-1.png'],
  sheet: { darkSkin: true },
  text: `${HK_BASE}. ${HK_STYLE} It shows 5 separate HEADLESS chibi character bodies in a single row. ${BODY_RULES.replace('bare light tan skin', 'bare MEDIUM BROWN skin (colour #9a6a45, clearly darker than the bodies of the reference image), and the hands, arms, legs and every other bit of visible skin have that same medium brown colour')} Outfits left to right: ${list(['a red hawaiian shirt with flowers, beige shorts and sandals', 'apron, a barbecue skewer in one hand, a cloth over the shoulder', 'open shirt, holding a tambourine', 'neon jacket, headphones hanging on the chest, holding a small DJ controller', 'white space suit with blue cloud patterns, gloves on'])}.`,
};
const newBodies = {
  file: 'skins-v2.png',
  kind: 'skin',
  keys: ['angelo-padel', 'pablo-galactico'],
  refs: ['skins-1.png'],
  text: `${HK_BASE}. ${HK_STYLE} It shows 2 separate HEADLESS chibi character bodies in a single row. ${BODY_RULES} Outfits left to right: ${list(['padel sportswear: a white and navy polo shirt, navy shorts, white sneakers and a wristband, holding a padel racket (a short solid paddle with round holes, no strings) down at the side', 'a legendary archmage: a long dark charcoal and midnight-blue robe with thin silver rune trim and a silver belt, the hood down around the neck stub, holding a dark wooden staff topped with one small pale-blue glowing crystal; sober, elegant, almost monochrome, no rainbow colours, no sparkles'])}.`,
};
calls.push(
  { label: 'heads-v2-1', images: [{ ...v2HeadSheet('heads-v2-1.png', V2_HEADS.slice(0, 3)), keys: ['_edecio', '_gladimir', 'guto'] }] },
  { label: 'heads-v2-gladimir', images: [gladimirHead] },
  { label: 'heads-v2-edecio', images: [edecioHead] },
  { label: 'heads-v2-2', images: [{ ...v2HeadSheet('heads-v2-2.png', V2_HEADS.slice(3)), keys: ['b2', '_angelo', 'pablo'] }] },
  { label: 'heads-v2-angelo', images: [angeloHead] },
  { label: 'skins-guto', images: [gutoBodies] },
  { label: 'skins-v2', images: [newBodies] },
);

// 8) Third pass: 18 new skins. Bodies four to a sheet, then one more row of headgear heads per professor.
const V3_BODIES = [
  ['edecio-gauchao', 'a gaucho from southern Brazil: white shirt, red neckerchief, wide baggy brown bombacha trousers tucked into leather boots, a wide leather belt, holding a chimarrão gourd with a metal straw'],
  ['edecio-formando', 'an elegant gentleman of the year 1900: dark vintage frock coat, waistcoat with a pocket-watch chain, bow tie, holding a walking cane'],
  ['edecio-lenda', 'a legendary golden outfit: shining gold suit with a gold cape, one hand is a giant golden thumbs-up glove'],
  ['gladimir-pescador', 'a fisherman: olive fishing vest with many pockets over a plaid shirt, rubber boots, holding a fishing rod in one hand and a small bucket in the other'],
  ['gladimir-bibliotecario', 'a librarian: burgundy cardigan over a shirt and tie, brown trousers, carrying a tall stack of books'],
  ['gladimir-guardiao', 'a legendary guardian knight: steel-blue plate armor with a navy cape, holding a big square shield shaped like a floppy disk'],
  ['b2-obra', 'a construction-site designer: orange work overalls over a white t-shirt, work boots, holding a rolled blueprint'],
  ['b2-pixel', 'an outfit made of neat coloured squares like big pixels in pink, teal and yellow, holding a giant ruler'],
  ['wagner-detetive', 'a classic detective: long beige trench coat with the collar up, dark trousers, holding a magnifying glass'],
  ['wagner-cavaleiro', 'a legendary dark knight: black plate armor with silver padlock emblems and a dark red cape, holding a sword whose blade is shaped like a big key'],
  ['b1-scrum', 'an agile coach: a teal vest covered in colourful round pin buttons over a white shirt, jeans, a whistle on a cord around the neck stub, holding a stopwatch'],
  ['b1-arquiteta', 'a master architect: an elegant dark teal long coat with a short cape and gold trim, holding a giant drawing compass'],
  ['angelo-capitao', 'a padel team captain: navy and gold sports jacket with a captain armband, white shorts, white sneakers, holding a golden trophy cup'],
  ['angelo-reitor', 'a university rector: a long ceremonial academic gown in deep red and black with a wide golden sash and gold embroidery, holding a golden academic mace'],
  ['pablo-garagem', 'a garage hacker: a worn dark grey hoodie with the hood down, cargo trousers, sneakers, holding a green circuit board with wires'],
  ['pablo-oraculo', 'a legendary oracle: a long pale ivory and soft gold tunic with a white sash, sandals, one hand raised with a floating translucent pale-blue sphere of data above it'],
];
const v3BodySheet = (file, items, extra = {}) => ({
  file,
  kind: 'skin',
  keys: items.map((i) => i[0]),
  refs: ['skins-1.png'],
  ...extra,
  text: `${HK_BASE}. ${HK_STYLE} It shows ${items.length} separate HEADLESS chibi character bodies in a single row. ${extra.rules ?? BODY_RULES} All bodies have the same height and the same proportions as the bodies of the reference image. Outfits left to right: ${list(items.map((i) => i[1]))}.`,
});
const GUTO_RULES = BODY_RULES.replace('bare light tan skin', 'bare MEDIUM BROWN skin (colour #9a6a45, clearly darker than the bodies of the reference image), and the hands and every other bit of visible skin have that same medium brown colour');
const V3_GUTO = [
  ['guto-paladino', 'a noble medieval paladin: polished steel plate armor with gold trim, a long royal-blue cape, a longsword in one hand and a kite shield with a white cloud crest in the other; heroic and dignified, not comic'],
  ['guto-capitao', 'a ship captain: a navy double-breasted captain coat with gold buttons and gold shoulder epaulettes, white trousers, black boots, holding a small wooden ship wheel'],
];

/** Headgear of the third pass, one extra row per professor (the first rows stay as they are). */
const HEAD_VARIANTS_2 = {
  edecio: [
    ['edecio-gauchao', 'a black wide-brim gaucho felt hat with a chin strap'],
    ['edecio-formando', 'a tall black top hat'],
  ],
  gladimir: [
    ['gladimir-pescador', 'an olive-green fisherman bucket hat with a fishing lure pinned on it'],
    ['gladimir-guardiao', 'an open-face steel-blue knight helmet with a navy plume, face fully visible'],
  ],
  b2: [['b2-obra', 'a yellow construction hard hat']],
  wagner: [
    ['wagner-detetive', 'a brown fedora hat'],
    ['wagner-cavaleiro', 'an open-face black knight helmet with silver trim and a dark red plume, face fully visible'],
  ],
  guto: [['guto-capitao', 'a white ship captain peaked cap with a gold anchor badge']],
  angelo: [['angelo-reitor', 'a round dark red velvet doctoral tam cap with a gold tassel']],
  pablo: [['pablo-garagem', 'big black over-ear headphones over the hair']],
};
const headVariantSheet2 = (professor) => {
  const base = headVariantSheet(professor);
  const items = HEAD_VARIANTS_2[professor];
  const first = HEAD_VARIANTS[professor];
  return {
    ...base,
    file: `heads-skin2-${professor}.png`,
    keys: ['_ref', ...items.map((i) => i[0])],
    text: base.text
      .replace(`${(first?.length ?? 0) + 1} times`, `${items.length + 1} times`)
      .replace(/Left to right after the plain one: .*$/, `Left to right after the plain one: ${list(items.map((i) => i[1]))}.`),
  };
};
HEAD_VARIANTS.b2 ??= [];

calls.push(
  { label: 'skins-v3-1', images: [v3BodySheet('skins-v3-1.png', V3_BODIES.slice(0, 4))] },
  { label: 'skins-v3-2', images: [v3BodySheet('skins-v3-2.png', V3_BODIES.slice(4, 8))] },
  { label: 'skins-v3-3', images: [v3BodySheet('skins-v3-3.png', V3_BODIES.slice(8, 12))] },
  { label: 'skins-v3-4', images: [v3BodySheet('skins-v3-4.png', V3_BODIES.slice(12))] },
  { label: 'skins-v3-guto', images: [v3BodySheet('skins-v3-guto.png', V3_GUTO, { rules: GUTO_RULES, sheet: { darkSkin: true } })] },
  ...Object.keys(HEAD_VARIANTS_2).map((professor) => ({ label: `heads-skin2-${professor}`, images: [headVariantSheet2(professor)] })),
);

// 9) Fourth pass: one mythic skin per professor (the rarest tier, so they get more ornate), three more skins,
//    and a scenery without a floor (the professor floats in it).
const WIDE = 'Every body is as broad and stocky as the bodies in the reference image (not slimmer), with the same height and proportions. No glow, no aura, no particles and no light effects outside the outline: the richness is in ornate detail, trim and layered cloth.';
const V4_MYTHIC_A = [
  ['edecio-primordial', 'a divine being of the thumbs-up: flowing white and gold celestial robes with a golden sash and sun emblems, one hand in a big golden gauntlet giving a thumbs-up'],
  ['gladimir-arquivista', 'an eternal archivist of data: a long deep-blue robe whose cloth shows glowing cyan table grids and rows, silver trim, holding an ancient glowing tome, two small data cubes floating by the shoulder'],
  ['b2-prisma', 'a muse of light: an elegant white dress that splits into a soft spectrum of colours toward the hem like light through a prism, crystal shoulder pieces, holding a crystal prism'],
  ['wagner-sentinela', 'an elite sentinel: sleek black plate armor with thin glowing red circuit lines, a dark red half-cape, a hexagonal red energy shield on one arm'],
];
const V4_MYTHIC_B = [
  ['b1-imperatriz', 'an empress of the roadmap: an imperial deep-purple and gold gown with a long mantle embroidered with a constellation map of stars joined by thin lines, holding a golden scepter'],
  ['angelo-chanceler', 'a supreme chancellor: immaculate white and gold ceremonial regalia with a long white cape, a wide gold sash, medals and a golden chain of office, holding a rolled diploma with a gold seal'],
  ['pablo-singularidade', 'the singularity: a long black robe whose cloth is a starfield with tiny stars and a faint purple nebula, thin silver trim, a small neural-network diagram of joined nodes glowing on the chest, one hand holding a small black sphere with a bright rim'],
];
const V4_GUTO = [
  ['guto-tempestade', 'a lord of the storm: dark steel-blue plate armor with gold lightning-bolt engravings, a long cape shaped like a dark storm cloud, holding a spear shaped like a lightning bolt; heroic and serious, not comic'],
];
const V4_MORE = [
  ['wagner-ferias', 'a tourist on holiday: an open colourful floral shirt over a white tank top, swim shorts, flip-flops, a yellow rubber-duck float ring around the waist, holding a coconut drink with a straw'],
  ['gladimir-drone', 'a relaxed engineer with his arms crossed over a grey polo shirt and jeans, a small quadcopter drone hovering by his shoulder holding a tiny computer mouse'],
  ['pablo-garagem', 'a cyberpunk hacker: a black techwear jacket with glowing cyan and magenta LED strips, fingerless gloves, cargo trousers, high-top sneakers, holding a glowing holographic tablet'],
];
const v4BodySheet = (file, items, extra = {}) => ({
  ...v3BodySheet(file, items, extra),
  text: `${v3BodySheet(file, items, extra).text} ${WIDE}`,
});

/** Headgear of the fourth pass. */
const HEAD_VARIANTS_3 = {
  edecio: [['edecio-primordial', 'a golden halo ring floating just above the hair with small sun rays, touching the top of the hair']],
  gladimir: [['gladimir-arquivista', 'the deep hood of a dark blue robe with a glowing cyan trim, hood up, face fully visible']],
  b2: [['b2-prisma', 'a crystal tiara with a rainbow-tinted gem on the forehead']],
  wagner: [
    ['wagner-sentinela', 'a sleek black open-face helmet with thin glowing red lines and a raised red visor, face fully visible'],
    ['wagner-ferias', 'a straw sun hat and dark sunglasses'],
  ],
  guto: [['guto-tempestade', 'a dark steel circlet crown with a small gold lightning bolt at the front']],
  b1: [['b1-imperatriz', 'a tall imperial gold crown with purple gems and small stars']],
  angelo: [['angelo-chanceler', 'a golden laurel wreath on the hair']],
  pablo: [
    ['pablo-singularidade', 'the deep hood of a black starfield robe with tiny stars on it, hood up, face fully visible'],
    ['pablo-garagem', 'a slim cyberpunk visor pushed up on the forehead and one small earpiece'],
  ],
};
HEAD_VARIANTS.b1 ??= [];
const headVariantSheet3 = (professor) => {
  const base = headVariantSheet(professor);
  const items = HEAD_VARIANTS_3[professor];
  const first = HEAD_VARIANTS[professor];
  return {
    ...base,
    file: `heads-skin3-${professor}.png`,
    keys: ['_ref', ...items.map((i) => i[0])],
    text: base.text
      .replace(`${(first?.length ?? 0) + 1} times`, `${items.length + 1} times`)
      .replace(/Left to right after the plain one: .*$/, `Left to right after the plain one: ${list(items.map((i) => i[1]))}.`),
  };
};

const galaxy = {
  file: 'scenery-galaxia.png',
  kind: 'scenery',
  keys: ['galaxia'],
  refs: ['scenery-espaco.png'],
  text: `a wide 16:9 landscape pixel-art game background, 16-bit SNES style, crisp chunky pixels, limited palette, no characters, no people, no text, no UI. ${HK_STYLE} Open outer space with no ground and no floor at all: a deep purple and blue nebula, a large ringed planet on one side, two smaller planets, a distant spiral galaxy and many stars. The centre of the image is calmer and darker, where a character will float.`,
};

calls.push(
  { label: 'skins-v4-mythic-1', images: [v4BodySheet('skins-v4-mythic-1.png', V4_MYTHIC_A)] },
  { label: 'skins-v4-mythic-2', images: [v4BodySheet('skins-v4-mythic-2.png', V4_MYTHIC_B)] },
  { label: 'skins-v4-guto', images: [v4BodySheet('skins-v4-guto.png', V4_GUTO, { rules: GUTO_RULES, sheet: { darkSkin: true } })] },
  { label: 'skins-v4-more', images: [v4BodySheet('skins-v4-more.png', V4_MORE)] },
  ...Object.keys(HEAD_VARIANTS_3).map((professor) => ({ label: `heads-skin3-${professor}`, images: [headVariantSheet3(professor)] })),
  { label: 'scenery-galaxia', images: [galaxy] },
);

// Reference heads for the head-variant calls: the processed head, enlarged, on the same magenta background.
fs.mkdirSync(RAW_DIR, { recursive: true });
for (const professor of Object.keys(HEAD_VARIANTS)) {
  const source = path.join(HEADS_DIR, `${professor}.png`);
  if (!fs.existsSync(source)) continue;
  const { width = 48, height = 56 } = await sharp(source).metadata();
  await sharp(source)
    .resize(width * 10, height * 10, { kernel: 'nearest' })
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#ff00ff' })
    .flatten({ background: '#ff00ff' })
    .png()
    .toFile(path.join(RAW_DIR, `ref-head-${professor}.png`));
}

// ---- write --------------------------------------------------------------------------------

fs.mkdirSync(QUEUE_DIR, { recursive: true });
for (const stale of fs.readdirSync(QUEUE_DIR)) fs.unlinkSync(path.join(QUEUE_DIR, stale));
calls.forEach((c, idx) => {
  const n = c.images.length;
  const head = PREFIX.replace('{N}', String(n)).replace('{S}', n > 1 ? 's' : '').replace('{THEM}', n > 1 ? 'them' : 'it');
  const body = c.images.map((im, k) => `${k + 1}) ${im.file}: ${im.text}`).join(' ');
  const prompt = `${head} ${body} ${SUFFIX}`;
  const file = path.join(QUEUE_DIR, `${String(idx + 1).padStart(2, '0')}-${c.label}.txt`);
  fs.writeFileSync(file, prompt + '\n');
  for (const im of c.images) sheets.push({ file: im.file, kind: im.kind, keys: im.keys, ...(im.calibrate ? { calibrate: true } : {}), ...(im.sheet ?? {}) });
});

// keep hand-added entries (e.g. real-photo heads) that this script does not generate
const known = new Set(sheets.map((x) => x.file));
const extra = (readJson(SHEETS_FILE, { sheets: [] }).sheets || []).filter((x) => !known.has(x.file));
writeJson(SHEETS_FILE, { sheets: [...sheets, ...extra] });
// The same queue for the API generator (scripts/art/generate.mjs): one entry per image.
writeJson(path.join(ROOT, 'art', 'queue.json'), {
  images: calls.flatMap((c) => c.images.map((im) => ({ file: im.file, kind: im.kind, keys: im.keys, prompt: im.text, ...(im.refs ? { refs: im.refs } : {}) }))),
});
console.log(`queue: ${calls.length} calls, ${sheets.length} sheets registered`);
