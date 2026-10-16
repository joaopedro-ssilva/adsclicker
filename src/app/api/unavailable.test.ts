import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema } from '@/shared/api';
import { POST as account } from './account/nickname/route';
import { POST as hackathonEquip } from './hackathon/equip/route';
import { POST as hackathonItems } from './hackathon/items/route';
import { POST as hackathonMentors } from './hackathon/mentors/route';
import { GET as hackathonProfile, POST as hackathonCreate } from './hackathon/profile/route';
import { POST as hackathonFinish } from './hackathon/run/finish/route';
import { POST as hackathonStart } from './hackathon/run/start/route';
import { POST as hackathonSkills } from './hackathon/skills/route';
import { POST as login } from './auth/login/route';
import { POST as logout } from './auth/logout/route';
import { GET as community } from './community/route';
import { GET as donors } from './community/donors/route';
import { GET as labLeaderboard } from './lab/leaderboard/route';
import { GET as leaderboard } from './leaderboard/route';
import { GET as me } from './me/route';
import { GET as ranks } from './me/ranks/route';
import { GET as profile } from './players/profile/route';
import { POST as sync } from './sync/route';

const origin = { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' };
const get = (path: string) => new Request(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000' } });
const post = (path: string, body: unknown) =>
  new Request(`http://localhost:3000${path}`, { method: 'POST', headers: origin, body: JSON.stringify(body) });

describe('without DATABASE_URL every route answers 503 unavailable', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  });

  const cases: [string, () => Promise<Response>][] = [
    ['sync', () => sync(post('/api/sync', { save: '{"version":1}', baseRev: 0 }))],
    ['me', () => me(get('/api/me'))],
    ['ranks', () => ranks(get('/api/me/ranks'))],
    ['profile', () => profile(get('/api/players/profile?nickname=maria'))],
    ['nickname', () => account(post('/api/account/nickname', { nickname: 'Maria', password: 'segredo1' }))],
    ['login', () => login(post('/api/auth/login', { nickname: 'maria', password: 'segredo1' }))],
    ['logout', () => logout(post('/api/auth/logout', {}))],
    ['leaderboard', () => leaderboard(get('/api/leaderboard?board=coins'))],
    ['donors', () => donors(get('/api/community/donors'))],
    ['lab leaderboard', () => labLeaderboard(get('/api/lab/leaderboard?board=phase'))],
    ['community', () => community()],
    ['hackathon profile', () => hackathonProfile(get('/api/hackathon/profile'))],
    ['hackathon create', () => hackathonCreate(post('/api/hackathon/profile', { head: 'h1' }))],
    ['hackathon start', () => hackathonStart(post('/api/hackathon/run/start', { stageId: 'cap1-fase1', auto: false }))],
    ['hackathon finish', () => hackathonFinish(post('/api/hackathon/run/finish', { runId: 'x', actions: [] }))],
    ['hackathon equip', () => hackathonEquip(post('/api/hackathon/equip', { slot: 'setup', itemId: null }))],
    ['hackathon skills', () => hackathonSkills(post('/api/hackathon/skills', { action: 'respec' }))],
    ['hackathon mentors', () => hackathonMentors(post('/api/hackathon/mentors', { professor: 'edecio' }))],
    ['hackathon items', () => hackathonItems(post('/api/hackathon/items', { action: 'recycle', itemIds: ['a'] }))],
  ];

  for (const [name, call] of cases) {
    it(name, async () => {
      const response = await call();
      expect(response.status).toBe(503);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe('unavailable');
    });
  }

  it('still rejects a cross-site Hackathon POST before looking for the database', async () => {
    const response = await hackathonStart(
      new Request('http://localhost:3000/api/hackathon/run/start', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' }),
    );
    expect(response.status).toBe(403);
  });

  it('still rejects a cross-site POST before looking for the database', async () => {
    const response = await sync(
      new Request('http://localhost:3000/api/sync', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' }),
    );
    expect(response.status).toBe(403);
  });
});
