// Fills the LOCAL database with players for the Laboratório boards (to look at the Ranking tab), and makes one more that
// the browser can sign in as. Never touches anything but DATABASE_URL (.env.local: the Docker database).
// Usage: npx tsx scripts/dev/lab-board-seed.ts [nickname-of-the-viewer]   →   prints the viewer's session token
//        (scripts/qa/lab.mjs --cookie=<token> opens the lab as that player; run it again to start over: it clears the seed first)
import { eq, inArray } from 'drizzle-orm';
import { content } from '@/game/content';
import { LAB_SLOTS } from '@/game/content/labTypes';
import { PROFESSOR_IDS } from '@/game/content/types';
import { createInitialState, serializeState } from '@/game/engine';
import type { LabProfileData } from '@/game/engine/lab/profile';
import type { LabBuild } from '@/game/engine/lab/types';
import { createGuest } from '@/server/auth/guest';
import { createDb } from '@/server/db/client';
import { players } from '@/server/db/schema';
import { nicknameKey } from '@/server/players/nickname';

process.loadEnvFile('.env.local');
const url = process.env.DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error('refusing to seed: DATABASE_URL is not the local database');

const { sql, db } = createDb(url, { max: 1 });
const viewer = process.argv[2] ?? 'Voce';

/** A build from the content: one item per slot, rarity and level as given (bases are picked by slot, in content order). */
function build(rarities: string[], levels: number[], offset = 0): LabBuild {
  return LAB_SLOTS.map((slot, i) => {
    const bases = content.lab.bases.filter((base) => base.slot === slot && base.drops);
    const base = bases[(i * 5 + offset) % bases.length] ?? bases[0]!;
    return { slot, base: base.id, rarity: rarities[i] as LabBuild[number]['rarity'], level: levels[i] ?? 1 };
  });
}


/** What a seeded player wears in the lab: a different monitor, theme and decoration each, so the lab profile has something to show. */
const LOOKS: Pick<LabProfileData, 'monitor' | 'theme' | 'decor' | 'startItem'>[] = [
  { monitor: 'monitor-tubo-adesivado', theme: 'tema-madrugada', decor: ['luminaria', 'gato-dormindo-no-monitor', 'cacto'], startItem: 'mouse-dourado' },
  { monitor: 'monitor-gamer-rgb', theme: 'tema-tela-azul', decor: ['luz-neon-codigo', 'mini-servidor', 'caneca-do-plantao', 'trofeu-de-hackathon'], startItem: 'trackball' },
  { monitor: 'monitor-ultrawide', theme: 'tema-masmorra', decor: ['pilha-de-livros-de-algoritmos', 'lixeira-reciclagem'], startItem: 'mouse-de-bolinha' },
  { monitor: 'monitor-tela-azul', theme: 'tema-grimorio', decor: ['poster-funciona-na-minha-maquina'], startItem: 'teclado-de-membrana-velho' },
  { monitor: 'monitor-crt-bege', theme: 'tema-fosforo', decor: [], startItem: 'mouse-quebrado' },
];

function labProfile(index: number, phase: number): LabProfileData {
  const look = LOOKS[index % LOOKS.length]!;
  return {
    ...look,
    stats: {
      bestPhase: phase,
      commitsEarned: phase * 41,
      runs: Math.ceil(phase / 3),
      broken: Math.ceil(phase / 3),
      phasesCleared: phase * 3,
      bossesBeaten: Math.floor(phase / 5),
      itemsFound: phase * 2,
      itemsRecycled: phase,
      itemLevelUps: phase,
      affixRerolls: Math.floor(phase / 2),
      clicks: phase * 310,
      cosmeticsOwned: 3 + look.decor.length + 2,
    },
  };
}
const ROWS: { name: string; phase: number; coins: number; rarities: string[]; levels: number[] }[] = [
  { name: 'Ana Luz', phase: 31, coins: 38.2, rarities: ['lendario', 'lendario', 'epico', 'lendario'], levels: [12, 11, 9, 10] },
  { name: 'Bruno_ADS', phase: 27, coins: 41.6, rarities: ['epico', 'lendario', 'epico', 'raro'], levels: [9, 12, 8, 6] },
  { name: 'Camila', phase: 27, coins: 33.1, rarities: ['epico', 'epico', 'raro', 'epico'], levels: [8, 8, 5, 7] },
  { name: 'Dudu', phase: 22, coins: 29.9, rarities: ['raro', 'epico', 'raro', 'raro'], levels: [6, 7, 5, 4] },
  { name: 'Edécio Jr', phase: 19, coins: 25.4, rarities: ['raro', 'raro', 'incomum', 'raro'], levels: [5, 4, 3, 4] },
  { name: 'Fernanda', phase: 15, coins: 22.7, rarities: ['incomum', 'raro', 'incomum', 'incomum'], levels: [3, 4, 2, 3] },
  { name: 'Gabriel', phase: 14, coins: 18.3, rarities: ['incomum', 'incomum', 'comum', 'incomum'], levels: [3, 2, 1, 2] },
  { name: 'Helena', phase: 9, coins: 12.8, rarities: ['comum', 'incomum', 'comum', 'comum'], levels: [1, 2, 1, 1] },
];

async function main(): Promise<void> {
  // Start over: the seeded players are found by their nickname keys (the profile card looks players up by them).
  const keys = [...ROWS.map((row) => nicknameKey(row.name)), ...[0, 1, 2].map((i) => nicknameKey(`Escondido ${i}`)), nicknameKey(viewer)];
  await db.delete(players).where(inArray(players.nicknameKey, keys));
  const base = Date.now() - 3 * 86_400_000;
  for (const [i, row] of ROWS.entries()) {
    const phaseBuild = build(row.rarities, row.levels, i);
    const runBuild = build(row.rarities, row.levels.map((level) => Math.max(1, level - 1)), i + 3);
    await db.insert(players).values({
      nickname: row.name,
      nicknameKey: nicknameKey(row.name),
      rev: 1,
      // A plain save, so the profile card (opened from the Ranking) has something to show.
      save: serializeState(createInitialState(content, Date.now())),
      avatarProfessor: PROFESSOR_IDS[i % PROFESSOR_IDS.length],
      createdAt: new Date(base),
      lastSeenAt: new Date(),
      labBestPhase: row.phase,
      labBestPhaseAt: new Date(base + i * 3_600_000),
      labBestPhaseBuild: phaseBuild,
      bestRunCoinsText: `${row.coins}e+30`,
      bestRunCoinsLog: 30 + Math.log10(row.coins),
      bestRunBuild: runBuild,
      labProfile: labProfile(i, row.phase),
    });
  }
  // Rows that must NOT show: flagged, banned, test account, no nickname.
  const hidden = [{ flagged: true }, { banned: true }, { testAccount: true }];
  for (const [i, extra] of hidden.entries()) {
    await db.insert(players).values({
      nickname: `Escondido ${i}`,
      nicknameKey: nicknameKey(`Escondido ${i}`),
      rev: 1,
      labBestPhase: 99,
      labBestPhaseAt: new Date(base),
      bestRunCoinsText: '9e+40',
      bestRunCoinsLog: 40.95,
      ...extra,
    });
  }

  // The viewer: a player with a session, a nickname and records of their own.
  const guest = await createGuest(db, '10.9.9.9');
  await db
    .update(players)
    .set({
      nickname: viewer,
      nicknameKey: nicknameKey(viewer),
      rev: 1,
      labBestPhase: 17,
      labBestPhaseAt: new Date(base + 9 * 3_600_000),
      labBestPhaseBuild: build(['raro', 'raro', 'incomum', 'epico'], [5, 5, 3, 6], 2),
      bestRunCoinsText: '24.1e+30',
      bestRunCoinsLog: 30 + Math.log10(24.1),
      bestRunBuild: build(['raro', 'epico', 'incomum', 'raro'], [4, 6, 3, 5], 5),
      labProfile: labProfile(2, 17),
    })
    .where(eq(players.id, guest.player.id));
  console.log(guest.token);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void sql.end({ timeout: 1 }));
