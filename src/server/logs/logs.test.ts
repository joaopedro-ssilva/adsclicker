/**
 * The server log: redaction and "never throws" run anywhere; the table tests need the test
 * database (they skip themselves without Docker, like the other integration tests).
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LOG_RETENTION_DAYS, LOG_RETENTION_MAX_ROWS } from '@/shared/api';
import { pruneFeed } from '../community/community';
import type { Db } from '../db/client';
import { feedEvents, players, serverLogs } from '../db/schema';
import { connectTestDb } from '../testing/db';
import { noteDatabaseDown, pendingOutage, pruneLogs, recordTraffic, redact, resetLogState, routeLabel, writeLog } from './log';
import { queryActivity, queryLogs } from './query';

describe('redact', () => {
  it('drops secrets, addresses and saves by key name, at any depth', () => {
    const clean = redact({
      nickname: 'ana',
      password: 'hunter2',
      currentPassword: 'x',
      token: 'abc',
      cookie: 'adsclicker_session=1',
      ip: '1.2.3.4',
      save: '{"big":"save"}',
      nested: { sessionToken: 'zzz', ok: 1 },
    }) as Record<string, unknown>;
    expect(clean.nickname).toBe('ana');
    expect(clean.password).toBe('[removido]');
    expect(clean.currentPassword).toBe('[removido]');
    expect(clean.token).toBe('[removido]');
    expect(clean.cookie).toBe('[removido]');
    expect(clean.ip).toBe('[removido]');
    expect(clean.save).toBe('[removido]');
    expect(clean.nested).toEqual({ sessionToken: '[removido]', ok: 1 });
    expect(JSON.stringify(clean)).not.toContain('hunter2');
  });

  it('trims long strings, long arrays and deep objects', () => {
    expect((redact('x'.repeat(1000)) as string).length).toBeLessThan(400);
    expect(redact(Array.from({ length: 100 }, (_, i) => i))).toHaveLength(20);
    expect(redact({ a: { b: { c: { d: 1 } } } })).toEqual({ a: { b: { c: '[…]' } } });
  });
});

describe('routeLabel', () => {
  it('keeps the path, hides ids and the query string', () => {
    expect(routeLabel('http://x.test/api/admin/players/2f1c3e0a-1111-4222-8333-444455556666?search=a')).toBe('/api/admin/players/[id]');
  });
});

describe('writeLog', () => {
  it('never throws, even when the database is broken', async () => {
    const broken = { insert: () => { throw new Error('boom'); } } as unknown as Db;
    await expect(writeLog(broken, { level: 'error', kind: 'x', message: 'y' })).resolves.toBeUndefined();
    await expect(pruneLogs(broken)).resolves.toBeUndefined();
    await expect(recordTraffic(broken, { accepted: true, playerId: 'p' })).resolves.toBeUndefined();
  });
});

describe('database outage memory', () => {
  beforeEach(resetLogState);
  it('counts failures and keeps the first and last time', () => {
    noteDatabaseDown('/api/sync', 1000);
    noteDatabaseDown(null, 5000);
    expect(pendingOutage()).toEqual({ firstAt: 1000, lastAt: 5000, count: 2, route: '/api/sync' });
  });
});

const testDb = await connectTestDb({ database: 'logs_test' });
afterAll(async () => {
  await testDb?.close();
});

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe.skipIf(!testDb)('server log in the database', () => {
  const db = () => testDb!.db;

  beforeEach(async () => {
    resetLogState();
    await testDb!.reset();
    await db().execute(sql`truncate table server_logs, traffic_hourly, traffic_hourly_players restart identity`);
  });

  it('stores an entry trimmed and redacted', async () => {
    await writeLog(db(), { level: 'warn', kind: 'login_failed', message: 'm'.repeat(1000), nickname: 'ana', detail: { reason: 'wrong_password', password: 'secret' } }, NOW);
    const result = await queryLogs(db(), { range: 'all' }, NOW);
    expect(result.entries).toHaveLength(1);
    const [entry] = result.entries;
    expect(entry?.message.length).toBeLessThanOrEqual(300);
    expect(entry?.detail).toEqual({ reason: 'wrong_password', password: '[removido]' });
  });

  it('writes the outage after the database answers again', async () => {
    noteDatabaseDown('/api/sync', NOW - 60_000);
    await writeLog(db(), { level: 'info', kind: 'ping', message: 'back' }, NOW);
    const kinds = (await queryLogs(db(), { range: 'all' }, NOW)).entries.map((e) => e.kind);
    expect(kinds).toContain('db_unreachable');
    expect(pendingOutage()).toBeNull();
  });

  it('filters by range, level, kind and text; newest first; pages with a cursor', async () => {
    await writeLog(db(), { level: 'info', kind: 'old', message: 'ancient', route: '/a' }, NOW - 3 * DAY);
    await writeLog(db(), { level: 'error', kind: 'server_error', message: 'database exploded', route: '/api/sync' }, NOW - 30 * 60_000);
    await writeLog(db(), { level: 'info', kind: 'guest_created', message: 'guest', nickname: 'Ana_Maria' }, NOW - 10 * 60_000);
    await writeLog(db(), { level: 'info', kind: 'guest_created', message: 'guest 2' }, NOW - 5 * 60_000);

    const hour = await queryLogs(db(), { range: '1h' }, NOW);
    expect(hour.entries.map((e) => e.message)).toEqual(['guest 2', 'guest', 'database exploded']);
    expect(hour.kinds).toEqual(['guest_created', 'server_error']);
    expect((await queryLogs(db(), { range: '24h' }, NOW)).entries).toHaveLength(3);
    expect((await queryLogs(db(), { range: '7d' }, NOW)).entries).toHaveLength(4);
    expect((await queryLogs(db(), { range: '7d', level: 'error' }, NOW)).entries).toHaveLength(1);
    expect((await queryLogs(db(), { range: '7d', kind: 'guest_created' }, NOW)).entries).toHaveLength(2);
    expect((await queryLogs(db(), { range: '7d', q: 'exploded' }, NOW)).entries).toHaveLength(1);
    expect((await queryLogs(db(), { range: '7d', q: 'ana_m' }, NOW)).entries).toHaveLength(1);
    expect((await queryLogs(db(), { range: '7d', q: '/api/sync' }, NOW)).entries).toHaveLength(1);
    // "_" and "%" are literal in the search.
    expect((await queryLogs(db(), { range: '7d', q: 'a%' }, NOW)).entries).toHaveLength(0);

    const first = await queryLogs(db(), { range: '7d', limit: 3 }, NOW);
    expect(first.entries).toHaveLength(3);
    expect(first.nextBefore).not.toBeNull();
    const second = await queryLogs(db(), { range: '7d', limit: 3, before: first.nextBefore ?? undefined }, NOW);
    expect(second.entries.map((e) => e.message)).toEqual(['ancient']);
    expect(second.nextBefore).toBeNull();
  });

  it('prunes by age and by row cap', async () => {
    await writeLog(db(), { level: 'info', kind: 'k', message: 'too old' }, NOW - (LOG_RETENTION_DAYS + 1) * DAY);
    await writeLog(db(), { level: 'info', kind: 'k', message: 'fresh' }, NOW - DAY);
    await pruneLogs(db(), NOW);
    expect((await queryLogs(db(), { range: 'all' }, NOW)).entries.map((e) => e.message)).toEqual(['fresh']);

    // Beyond the cap the oldest go: fill just over it with one statement.
    await db().execute(
      sql`insert into server_logs (at, level, kind, message) select now(), 'info', 'bulk', 'n' || g from generate_series(1, ${LOG_RETENTION_MAX_ROWS + 5}) g`,
    );
    await pruneLogs(db(), Date.now());
    const [count] = await db().select({ n: sql<number>`count(*)::int` }).from(serverLogs);
    expect(count?.n).toBe(LOG_RETENTION_MAX_ROWS);
  }, 60_000);

  it('counts traffic per hour with distinct players', async () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    await recordTraffic(db(), { accepted: true, playerId: a }, NOW);
    await recordTraffic(db(), { accepted: true, playerId: a }, NOW + 1000);
    await recordTraffic(db(), { accepted: true, playerId: b }, NOW + 2000);
    await recordTraffic(db(), { accepted: false, playerId: b }, NOW + 3000);
    const { traffic } = await queryLogs(db(), { range: '1h' }, NOW + 4000);
    expect(traffic).toEqual([{ hour: NOW, accepted: 3, rejected: 1, players: 2 }]);
  });
});

describe.skipIf(!testDb)('class activity (feed_events)', () => {
  const db = () => testDb!.db;
  let ana = '';
  let bruno = '';

  beforeEach(async () => {
    await testDb!.reset();
    const rows = await db()
      .insert(players)
      .values([
        { nickname: 'Ana', nicknameKey: 'ana' },
        { nickname: 'Bruno', nicknameKey: 'bruno' },
      ])
      .returning({ id: players.id });
    ana = rows[0]?.id ?? '';
    bruno = rows[1]?.id ?? '';
  });

  const event = (playerId: string, kind: string, detail: string, at: number) => ({ playerId, kind, detail, createdAt: new Date(at) });

  it('lists every event (not just 30), newest first, filtered and paged', async () => {
    const many = Array.from({ length: 40 }, (_, i) => event(ana, 'graduation', String(i + 1), NOW - (i + 1) * 60_000));
    await db().insert(feedEvents).values([
      ...many,
      event(bruno, 'hire', 'edecio', NOW - 90 * 60_000),
      event(bruno, 'joined', '', NOW - 3 * DAY),
    ]);

    const hour = await queryActivity(db(), { range: '1h', limit: 200 }, NOW);
    expect(hour.entries).toHaveLength(40);
    expect(hour.entries[0]).toMatchObject({ nickname: 'Ana', kind: 'graduation', detail: '1' });
    expect(hour.entries[0]?.at).toBe(NOW - 60_000);

    expect((await queryActivity(db(), { range: '24h', limit: 200 }, NOW)).entries).toHaveLength(41);
    expect((await queryActivity(db(), { range: 'all', limit: 200 }, NOW)).entries).toHaveLength(42);
    expect((await queryActivity(db(), { range: 'all', kind: 'joined' }, NOW)).entries).toHaveLength(1);
    const byName = await queryActivity(db(), { range: 'all', q: 'brun', limit: 200 }, NOW);
    expect(byName.entries.map((e) => e.kind)).toEqual(['hire', 'joined']);
    expect(byName.entries[1]?.detail).toBeNull();

    const seen: string[] = [];
    let before: string | undefined;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await queryActivity(db(), { range: 'all', limit: 15, before }, NOW);
      seen.push(...page.entries.map((e) => e.id));
      if (page.nextBefore === null) break;
      before = page.nextBefore;
    }
    expect(seen).toHaveLength(42);
    expect(new Set(seen).size).toBe(42);
  });

  it('pruneFeed keeps 30 days and at most the row cap', async () => {
    await db().insert(feedEvents).values([
      event(ana, 'hire', 'edecio', NOW - 20 * DAY),
      event(ana, 'hire', 'bruna', NOW - (LOG_RETENTION_DAYS + 1) * DAY),
    ]);
    await pruneFeed(db(), NOW);
    const left = await queryActivity(db(), { range: 'all' }, NOW);
    expect(left.entries.map((e) => e.detail)).toEqual(['edecio']);
    expect(left.retentionDays).toBe(30);
  });
});
