// Fills the LOCAL database with donors for the Centro Comunitário board (to look at the window), makes one more player
// the browser can sign in as, and writes that player's local save (coins in hand, a total already donated).
// Never touches anything but DATABASE_URL (.env.local: the Docker database). Run it again to start over.
// Usage: npx tsx scripts/dev/donors-seed.ts <viewer-save.json> [nickname-of-the-viewer]   →   prints the viewer's session token
//        (scripts/qa/community-center.mjs <viewer-save.json> <out-dir> --cookie=<token> takes the screenshots)
import { writeFileSync } from 'node:fs';
import { eq, inArray } from 'drizzle-orm';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Decimal, createInitialState, serializeState } from '@/game/engine';
import { createGuest } from '@/server/auth/guest';
import { createDb } from '@/server/db/client';
import { players } from '@/server/db/schema';
import { nicknameKey } from '@/server/players/nickname';

process.loadEnvFile('.env.local');
const url = process.env.DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error('refusing to seed: DATABASE_URL is not the local database');

const { sql, db } = createDb(url, { max: 1 });
const saveFile = process.argv[2] ?? 'donors-viewer-save.json';
const viewer = process.argv[3] ?? 'Voce';

/** [nickname, donated as mantissa, exponent]: the whole ladder of titles is on the board. */
const ROWS: [string, number, number][] = [
  ['Ana Luz', 4.2, 94],
  ['Bruno_ADS', 8.1, 65],
  ['Camila', 2.7, 63],
  ['Dudu', 6.4, 47],
  ['Edécio Jr', 1.3, 45],
  ['Fernanda', 9.9, 34],
  ['Gabriel', 3.3, 33],
  ['Helena', 7.5, 25],
  ['Igor', 1.1, 24],
  ['Julia', 5.5, 15],
  ['Kaua', 2.2, 13],
  ['Lara', 8.8, 9],
];

async function main(): Promise<void> {
  const keys = [...ROWS.map(([name]) => nicknameKey(name)), ...[0, 1, 2].map((i) => nicknameKey(`Escondido ${i}`)), nicknameKey(viewer)];
  await db.delete(players).where(inArray(players.nicknameKey, keys));
  const base = Date.now() - 3 * 86_400_000;
  for (const [i, [name, mantissa, exponent]] of ROWS.entries()) {
    await db.insert(players).values({
      nickname: name,
      nicknameKey: nicknameKey(name),
      rev: 1,
      save: serializeState(createInitialState(content, Date.now())),
      avatarProfessor: PROFESSOR_IDS[i % PROFESSOR_IDS.length],
      createdAt: new Date(base),
      lastSeenAt: new Date(),
      donatedText: `${mantissa}e+${exponent}`,
      donatedLog: exponent + Math.log10(mantissa),
    });
  }
  // Rows that must NOT show: flagged, banned, test account.
  for (const [i, extra] of [{ flagged: true }, { banned: true }, { testAccount: true }].entries()) {
    await db.insert(players).values({
      nickname: `Escondido ${i}`,
      nicknameKey: nicknameKey(`Escondido ${i}`),
      rev: 1,
      donatedText: '9e+99',
      donatedLog: 99.95,
      ...extra,
    });
  }

  // The viewer: a session, a nickname and a donation of 2.4 Sp (Apoiador), past the top 10 so the pinned row shows.
  const guest = await createGuest(db, '10.9.9.9');
  await db
    .update(players)
    .set({ nickname: viewer, nicknameKey: nicknameKey(viewer), rev: 1, donatedText: '2.4e+24', donatedLog: 24 + Math.log10(2.4) })
    .where(eq(players.id, guest.player.id));

  const state = createInitialState(content, Date.now());
  for (const id of PROFESSOR_IDS) state.hired[id] = true;
  state.coins = new Decimal('3.7e30');
  state.runCoins = new Decimal('3.7e30');
  state.lifetimeCoins = new Decimal('9e31');
  state.donated = new Decimal('2.4e24');
  state.counters.donations = 3;
  writeFileSync(saveFile, serializeState(state));
  console.log(guest.token);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void sql.end({ timeout: 1 }));
