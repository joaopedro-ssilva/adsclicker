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

const letters = 'abcd';
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

// Described generically on purpose: the image tool rejects prompts that name the film characters.
const STAR_WARS = [
  ['gladimir-stormtrooper', 'glossy white sci-fi space-soldier armor with black joints and a black utility belt, holding a black blaster rifle'],
  ['gladimir-vader', 'black sci-fi dark-lord armor with a long black cape and a chest control panel with small coloured buttons, a glowing red energy sword in one hand, a glossy black helmet tucked under the other arm'],
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
  ],
  pablo: [['pablo-mago', 'a tall blue wizard hat with yellow stars']],
};

// ---- builders -----------------------------------------------------------------------------

const calls = []; // { label, images: [{file, kind, keys, text}] }
const sheets = [];

function skinSheet(file, items) {
  return {
    file,
    kind: 'skin',
    keys: items.map((i) => i[0]),
    text: `${BASE}. It shows ${items.length} separate HEADLESS chibi character bodies in a single row. ${BODY_RULES} Outfits left to right: ${list(items.map((i) => i[1]))}.`,
  };
}

// 1) heads: already generated (heads-1.png, heads-2.png) -> only registered
sheets.push({ file: 'heads-1.png', kind: 'head', keys: ['edecio', 'gladimir', 'b2', 'wagner'] });
sheets.push({ file: 'heads-2.png', kind: 'head', keys: ['guto', 'b1', 'angelo', 'pablo'] });

// 2) default skins (already generated by the first skin call) -> registered
sheets.push({ file: 'skins-1.png', kind: 'skin', keys: ['edecio-default', 'gladimir-default', 'b2-default', 'wagner-default'] });
sheets.push({ file: 'skins-2.png', kind: 'skin', keys: ['guto-default', 'b1-default', 'angelo-default', 'pablo-default'] });

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

// Order = priority: the heads with headgear (the owner asked for them first), then the Star Wars skins,
// then the bodies that are still missing.
calls.push(
  ...skinCalls.slice(0, 2),
  headCall('edecio', 'gladimir'),
  headCall('wagner', 'guto'),
  headCall('b1', 'angelo'),
  headCall('pablo'),
  { label: 'skins-starwars', images: [skinSheet('skins-starwars.png', STAR_WARS)] },
  ...skinCalls.slice(2),
  iconsCall,
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
  for (const im of c.images) sheets.push({ file: im.file, kind: im.kind, keys: im.keys, ...(im.calibrate ? { calibrate: true } : {}) });
});

// keep hand-added entries (e.g. real-photo heads) that this script does not generate
const known = new Set(sheets.map((x) => x.file));
const extra = (readJson(SHEETS_FILE, { sheets: [] }).sheets || []).filter((x) => !known.has(x.file));
writeJson(SHEETS_FILE, { sheets: [...sheets, ...extra] });
console.log(`queue: ${calls.length} calls, ${sheets.length} sheets registered`);
