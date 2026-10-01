import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema } from '@/shared/api';
import { POST as account } from './account/nickname/route';
import { POST as login } from './auth/login/route';
import { POST as logout } from './auth/logout/route';
import { GET as community } from './community/route';
import { GET as leaderboard } from './leaderboard/route';
import { GET as me } from './me/route';
import { GET as ranks } from './me/ranks/route';
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
    ['nickname', () => account(post('/api/account/nickname', { nickname: 'Maria' }))],
    ['login', () => login(post('/api/auth/login', { nickname: 'maria', password: 'segredo1' }))],
    ['logout', () => logout(post('/api/auth/logout', {}))],
    ['leaderboard', () => leaderboard(get('/api/leaderboard?board=coins'))],
    ['community', () => community()],
  ];

  for (const [name, call] of cases) {
    it(name, async () => {
      const response = await call();
      expect(response.status).toBe(503);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe('unavailable');
    });
  }

  it('still rejects a cross-site POST before looking for the database', async () => {
    const response = await sync(
      new Request('http://localhost:3000/api/sync', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' }),
    );
    expect(response.status).toBe(403);
  });
});
