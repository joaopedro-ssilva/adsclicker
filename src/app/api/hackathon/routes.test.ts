/**
 * The Hackathon routes end to end through their handlers, against the test database: the wiring
 * (session, same-origin, validation, rate limits). The rules themselves are tested in
 * src/server/hackathon. Skips itself without Docker.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { createInitialState, serializeState } from '@/game/engine';
import { syncPlayer } from '@/server/players/sync';
import { SESSION_COOKIE } from '@/server/auth/session';
import { connectTestDb } from '@/server/testing/db';
import { apiErrorSchema } from '@/shared/api';
import { profileResponseSchema } from '@/shared/hackathonApi';
import { POST as equip } from './equip/route';
import { GET as getProfile, POST as createProfile } from './profile/route';
import { POST as finish } from './run/finish/route';
import { POST as start } from './run/start/route';

// Its own database: test files run in parallel and each one truncates its tables.
const testDb = await connectTestDb({ database: 'adsclicker_hackathon_routes_test' });
const previousUrl = process.env.DATABASE_URL;

afterAll(async () => {
  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;
  await testDb?.close();
});

const sameSite = { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' };
const get = (path: string, cookie?: string) =>
  new Request(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000', ...(cookie ? { cookie } : {}) } });
const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { ...sameSite, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const errorCode = async (response: Response) => apiErrorSchema.parse(await response.json()).error.code;

describe.skipIf(!testDb)('Hackathon routes', () => {
  if (!testDb) return;
  let cookie = '';

  beforeAll(() => {
    if (testDb) process.env.DATABASE_URL = testDb.url;
  });

  beforeEach(async () => {
    await testDb.reset();
    const result = await syncPlayer(testDb.db, {
      request: { save: serializeState(createInitialState(content, Date.now())), baseRev: 0 },
      token: null,
      ip: '10.9.9.9',
    });
    cookie = result.cookies.find((entry) => entry.startsWith(`${SESSION_COOKIE}=`))?.split(';')[0] ?? '';
  });

  it('answers 401 without a session on every route', async () => {
    for (const response of [
      await getProfile(get('/api/hackathon/profile')),
      await createProfile(post('/api/hackathon/profile', { head: 'h1' })),
      await start(post('/api/hackathon/run/start', { stageId: 'cap1-fase1', auto: false })),
      await finish(post('/api/hackathon/run/finish', { runId: 'x', actions: [] })),
      await equip(post('/api/hackathon/equip', { slot: 'setup', itemId: null })),
    ]) {
      expect(response.status).toBe(401);
      expect(await errorCode(response)).toBe('unauthorized');
    }
  });

  it('rejects a cross-site POST and a body that breaks the schema', async () => {
    const crossSite = await start(
      new Request('http://localhost:3000/api/hackathon/run/start', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'cross-site', cookie },
        body: JSON.stringify({ stageId: 'cap1-fase1', auto: false }),
      }),
    );
    expect(crossSite.status).toBe(403);
    for (const body of [{}, { stageId: 3, auto: false }, { stageId: 'a', auto: 'yes' }, { stageId: '', auto: true }]) {
      const response = await start(post('/api/hackathon/run/start', body, cookie));
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe('invalid');
    }
    const bad = await finish(post('/api/hackathon/run/finish', { runId: 'r', actions: [{ tick: -1, kind: 'flow' }] }, cookie));
    expect(bad.status).toBe(400);
  });

  it('reads the profile of a player who has not unlocked the mode (or says unavailable while the engine is a placeholder)', async () => {
    const response = await getProfile(get('/api/hackathon/profile', cookie));
    expect([200, 503]).toContain(response.status);
    if (response.status === 200) {
      const body = profileResponseSchema.parse(await response.json());
      expect(body).toMatchObject({ unlocked: false, profile: null });
      expect(body.lockReason).toMatch(/Bruna B2/);
    } else {
      expect(await errorCode(response)).toBe('unavailable');
    }
  });

  it('rate-limits run starts to a few per minute', async () => {
    // Fixed one-minute windows: do not straddle a boundary.
    const untilNextMinute = 60_000 - (Date.now() % 60_000);
    if (untilNextMinute < 4_000) await new Promise((resolve) => setTimeout(resolve, untilNextMinute + 100));
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      statuses.push((await start(post('/api/hackathon/run/start', { stageId: 'cap1-fase1', auto: false }, cookie))).status);
    }
    expect(statuses.slice(0, 6).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(6)).toEqual([429, 429]);
  });
});
