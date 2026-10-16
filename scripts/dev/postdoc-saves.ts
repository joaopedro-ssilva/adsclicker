// Builds a save to look at the Pós-doc (see scripts/qa/postdoc.mjs): Edécio with the Domínio at 40 and two stars,
// other professors with stars of their own, and the ADScoins to pay the next one.
// Usage: npx tsx scripts/dev/postdoc-saves.ts <out-dir>   ->   writes <out-dir>/postdoc.json (raw JSON, as localStorage keeps it)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Decimal, createInitialState } from '@/game/engine';
import { serializeState } from '@/game/engine/save';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const now = Date.now();

const state = createInitialState(content, now);
for (const id of PROFESSOR_IDS) state.hired[id] = true;
for (const discipline of content.disciplines) state.levels[discipline.id] = 120;
// Edécio and B2 at the cap (334 + 333 + 333 levels = Domínio 40).
for (const id of ['edecio', 'b2'] as const) {
  const own = content.disciplines.filter((def) => def.professor === id);
  own.forEach((def) => {
    state.levels[def.id] = 334;
  });
}
state.activeProfessor = 'edecio';
state.coins = new Decimal('8e36');
state.runCoins = new Decimal('8e36');
state.lifetimeCoins = new Decimal('4e40');
state.diplomas = 400;
state.diplomasEarned = 400;
state.counters.graduations = 6;
state.postdoc.stars.edecio = 2;
state.postdoc.turma.edecio = 4;
state.postdoc.stars.gladimir = 5;
state.postdoc.stars.pablo = 1;
state.postdoc.stars.b1 = 3;
state.counters.postdocs = 11;
state.lastTickAt = now;
writeFileSync(join(out, 'postdoc.json'), serializeState(state));
console.log('postdoc.json');
