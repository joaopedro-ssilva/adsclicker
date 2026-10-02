// Generates the queued sprite sheets with the OpenAI Images API (paid per image, no Codex quota).
//
//   node scripts/art/generate.mjs                     every queued image whose raw file is missing
//   node scripts/art/generate.mjs --only=icons.png    one image
//   node scripts/art/generate.mjs --dry               list what would be generated, spend nothing
//   node scripts/art/generate.mjs --quality=high      low | medium (default) | high
//
// The queue comes from art/queue.json (written by scripts/art/queue.mjs). Needs OPENAI_API_KEY in
// .env.local. Then: npm run art:process && npm run art:manifest
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR, ROOT, readJson } from './lib.mjs';

const QUEUE_FILE = path.join(ROOT, 'art', 'queue.json');
const PROMPTS_LOG = path.join(ROOT, 'art', 'prompts.md');
const API = 'https://api.openai.com/v1/images';
// Sheets are a row of sprites: landscape gives each one the most pixels.
const SIZE = { sheet: '1536x1024', scenery: '1536x1024' };

const flags = process.argv.slice(2);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.split('=')[1];
const dry = flags.includes('--dry');
const only = flag('only');
const quality = flag('quality') ?? 'medium';

const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.OPENAI_API_KEY;
const model = process.env.ART_IMAGE_MODEL ?? 'gpt-image-2';

const queue = readJson(QUEUE_FILE, { images: [] }).images;
const pending = queue.filter((image) => (only ? image.file === only : !fs.existsSync(path.join(RAW_DIR, image.file))));

if (pending.length === 0) {
  console.log(only ? `"${only}" is not in art/queue.json.` : 'Nothing to generate: every queued image already exists in art/raw.');
  process.exit(0);
}
if (dry) {
  for (const image of pending) console.log(`${image.file}  [${image.kind}]  ${image.keys.join(', ')}${image.refs?.length ? `  (refs: ${image.refs.join(', ')})` : ''}`);
  console.log(`${pending.length} image(s) would be generated with ${model}, quality ${quality}.`);
  process.exit(0);
}
if (!key) {
  console.error('OPENAI_API_KEY is not set. Add it to .env.local (the full key, starting with "sk-").');
  process.exit(1);
}

/** Text-only prompts use /generations; prompts with reference images use /edits (multipart). */
async function request(image) {
  const common = {
    model,
    prompt: image.prompt,
    size: SIZE[image.kind === 'scenery' ? 'scenery' : 'sheet'],
    quality,
    output_format: 'png',
    // Sceneries are full pictures; sprite sheets are cut out, so a transparent background saves a step.
    background: image.kind === 'scenery' ? 'opaque' : 'transparent',
  };
  if (!image.refs?.length) {
    return fetch(`${API}/generations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(common),
    });
  }
  const form = new FormData();
  for (const [name, value] of Object.entries(common)) form.append(name, value);
  for (const ref of image.refs) {
    const bytes = fs.readFileSync(path.join(RAW_DIR, ref));
    form.append('image[]', new Blob([bytes], { type: 'image/png' }), ref);
  }
  return fetch(`${API}/edits`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
}

fs.mkdirSync(RAW_DIR, { recursive: true });
let done = 0;
for (const image of pending) {
  process.stdout.write(`${image.file} ... `);
  const response = await request(image);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.[0]?.b64_json) {
    // Stop at the first failure: a billing, verification or moderation problem will not fix itself on the next image.
    console.error(`failed (HTTP ${response.status}): ${body?.error?.message ?? 'unexpected response'}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(RAW_DIR, image.file), Buffer.from(body.data[0].b64_json, 'base64'));
  fs.appendFileSync(PROMPTS_LOG, `\n## ${image.file} (${model}, ${quality})\n\n> ${image.prompt}\n`);
  const usage = body.usage ? `  tokens in/out: ${body.usage.input_tokens ?? '?'}/${body.usage.output_tokens ?? '?'}` : '';
  console.log(`ok${usage}`);
  done += 1;
}
console.log(`${done} image(s) saved to art/raw. Next: npm run art:process && npm run art:manifest`);
