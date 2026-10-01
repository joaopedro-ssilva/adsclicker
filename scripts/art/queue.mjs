// Builds the generation queue: art/queue/NN-<label>.txt (one Codex call each, max 2 images) and
// registers every expected sheet in art/sheets.json. Run again any time: it is idempotent.
//   node scripts/art/queue.mjs
// Then run the queue with: bash art/run-queue.sh   (sequential, stops at the first usage-limit error)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SHEETS_FILE, readJson, writeJson } from './lib.mjs';

const QUEUE_DIR = path.join(ROOT, 'art', 'queue');

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
  // Added after the first batches: kept at the end so the sheets already generated keep their grouping.
  ['gladimir-stormtrooper', 'white imperial stormtrooper armor with black joints and a black belt, holding a blaster rifle'],
  ['gladimir-vader', 'black Darth Vader armor with a long black cape and a chest control panel, a glowing red lightsaber in one hand, a black helmet tucked under the other arm'],
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

const HATS = [
  ['edecio-cria', 'a flat-brim baseball cap'],
  ['guto-pagodeiro', 'a panama straw hat'],
  ['b1-rainha', 'a golden crown with jewels'],
  ['angelo-rei', 'a royal golden crown with red velvet'],
  ['angelo-paraninfo', 'a black graduation mortarboard cap with a tassel'],
  ['pablo-mago', 'a tall blue wizard hat with stars'],
  ['edecio-gladiador', 'a Roman helmet with a red crest'],
  ['edecio-samurai', 'a samurai kabuto helmet with horns'],
  ['edecio-full-dima', 'a blocky voxel-style diamond-blue helmet'],
  ['gladimir-piloto', 'a pilot helmet with goggles'],
  ['wagner-cripto', 'a silver knight helmet'],
];

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
function sheetAfter(file, kind, keys, text) {
  return { file, kind, keys, text };
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

// 4) the other 38 skins, 4 per sheet, 2 sheets per call, professor order
const skinSheets = [];
for (let i = 0; i < SKINS.length; i += 4) skinSheets.push(SKINS.slice(i, i + 4));
for (let i = 0; i < skinSheets.length; i += 2) {
  const n = i / 2 + 1;
  calls.push({
    label: `skins-more-${n}`,
    images: skinSheets.slice(i, i + 2).map((items, k) => skinSheet(`skins-more-${i + k + 1}.png`, items)),
  });
}

// 5) icons (1 image) + first hat sheet, 6) other hat sheets
const hatSheets = [];
for (let i = 0; i < HATS.length; i += 4) hatSheets.push(HATS.slice(i, i + 4));
const hatText = (items) =>
  `${BASE}. It shows ${items.length} separate pieces of headgear alone (no head, no face, no hair, nothing inside them), front view, each a simple shape that rests on top of a head, drawn at roughly the same width, in a single row, well spaced, not touching. Left to right: ${list(items.map((i) => i[1]))}.`;
const hatImg = (items, n) => ({ file: `hats-${n}.png`, kind: 'hat', keys: items.map((i) => i[0]), text: hatText(items) });
calls.push({
  label: 'icons-hats-1',
  images: [
    {
      file: 'icons.png',
      kind: 'icon',
      keys: ['coin', 'diploma'],
      text: `${BASE}. It shows 2 separate chunky game icons in a single row, well spaced, not touching, front view, bold simple shapes with a thick dark outline: (a) a shiny gold coin with a large letter "E" on it; (b) a rolled diploma scroll tied with a red ribbon.`,
    },
    hatImg(hatSheets[0], 1),
  ],
});
for (let i = 1; i < hatSheets.length; i++) calls.push({ label: `hats-${i + 1}`, images: [hatImg(hatSheets[i], i + 1)] });

// ---- write --------------------------------------------------------------------------------

fs.mkdirSync(QUEUE_DIR, { recursive: true });
calls.forEach((c, idx) => {
  const n = c.images.length;
  const head = PREFIX.replace('{N}', String(n)).replace('{S}', n > 1 ? 's' : '').replace('{THEM}', n > 1 ? 'them' : 'it');
  const body = c.images.map((im, k) => `${k + 1}) ${im.file}: ${im.text}`).join(' ');
  const prompt = `${head} ${body} ${SUFFIX}`;
  const file = path.join(QUEUE_DIR, `${String(idx + 1).padStart(2, '0')}-${c.label}.txt`);
  fs.writeFileSync(file, prompt + '\n');
  for (const im of c.images) sheets.push({ file: im.file, kind: im.kind, keys: im.keys });
});

// keep hand-added entries (e.g. real-photo heads) that this script does not generate
const known = new Set(sheets.map((x) => x.file));
const extra = (readJson(SHEETS_FILE, { sheets: [] }).sheets || []).filter((x) => !known.has(x.file));
writeJson(SHEETS_FILE, { sheets: [...sheets, ...extra] });
console.log(`queue: ${calls.length} calls, ${sheets.length} sheets registered`);
