import { desc, eq, lt, sql } from 'drizzle-orm';
import { FEED_KINDS, LOG_RETENTION_DAYS, LOG_RETENTION_MAX_ROWS, ONLINE_WINDOW_MS } from '@/shared/api';
import type { CommunityResponse, FeedItem } from '@/shared/api';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { feedEvents, players, rankedCondition } from '../db/schema';
import { flaggedAreRanked } from '../players/ranking';
import { titlesForWire } from '../players/titles';
import { createTtlCache } from './cache';

export const FEED_SIZE = 30;
/** The game shows 30 events, but the admin "Atividades" view reads the whole table: keep it as long as the server log. */
const FEED_KEEP_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

/** Players that count in the totals: everyone who is not banned or a test account (nickname or not); flagged ones only in the test phase. */
const counted = () =>
  flaggedAreRanked()
    ? sql`not ${players.banned} and not ${players.testAccount}`
    : sql`not ${players.banned} and not ${players.flagged} and not ${players.testAccount}`;

/** to_char prints " 1.5000000000e+05" (zero as " 0.0000000000e+00"); the game wants "1.5e5". */
export function cleanCoins(text: string | null): string {
  const match = /^\s*(\d)\.?(\d*)e([+-]\d+)\s*$/i.exec(text ?? '');
  if (!match) return '0';
  const [, whole = '0', fraction = '', exponent = '0'] = match;
  const digits = fraction.replace(/0+$/, '');
  if (whole === '0' && digits === '') return '0';
  return `${whole}${digits ? `.${digits}` : ''}e${Number(exponent)}`;
}

function isFeedKind(kind: string): kind is FeedItem['kind'] {
  return (FEED_KINDS as readonly string[]).includes(kind);
}

async function loadCommunity(db: Db, now: number): Promise<CommunityResponse> {
  // Raw sql`` params are not mapped by Drizzle: pass the instant as text and cast it.
  const onlineSince = new Date(now - ONLINE_WINDOW_MS).toISOString();
  const [totals, feedRows, eventMultiplier] = await Promise.all([
    db
      .select({
        players: sql<number>`count(*)::int`,
        online: sql<number>`(count(*) filter (where ${players.lastSeenAt} > ${onlineSince}::timestamptz))::int`,
        coins: sql<string | null>`to_char(coalesce(sum(${players.lifetimeCoins}), 0), '9.9999999999EEEE')`,
        graduations: sql<number>`coalesce(sum(${players.graduations}), 0)::int`,
        clicks: sql<string>`coalesce(sum(${players.clicks}), 0)::text`,
        achievements: sql<number>`coalesce(sum(${players.achievements}), 0)::int`,
      })
      .from(players)
      .where(counted()),
    db
      .select({
        id: feedEvents.id,
        nickname: players.nickname,
        titles: players.titles,
        kind: feedEvents.kind,
        detail: feedEvents.detail,
        createdAt: feedEvents.createdAt,
      })
      .from(feedEvents)
      .innerJoin(players, eq(players.id, feedEvents.playerId))
      .where(rankedCondition())
      .orderBy(desc(feedEvents.createdAt))
      .limit(FEED_SIZE),
    getEventMultiplier(db, now),
  ]);

  const row = totals[0];
  const feed: FeedItem[] = [];
  for (const event of feedRows) {
    const titles = titlesForWire(event.titles);
    if (event.nickname !== null && isFeedKind(event.kind)) {
      feed.push({
        id: event.id,
        nickname: event.nickname,
        kind: event.kind,
        detail: event.detail === '' ? null : event.detail,
        at: event.createdAt.getTime(),
        ...(titles ? { titles } : {}),
      });
    }
  }

  pruneFeedLater(db, now);
  return {
    online: row?.online ?? 0,
    players: row?.players ?? 0,
    coins: cleanCoins(row?.coins ?? null),
    graduations: row?.graduations ?? 0,
    clicks: row?.clicks ?? '0',
    achievements: row?.achievements ?? 0,
    eventMultiplier,
    feed,
    updatedAt: now,
  };
}

let lastPrune = 0;

/** Old events: sweep them about hourly per instance, without making a request wait. */
function pruneFeedLater(db: Db, now: number): void {
  if (now - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now;
  void pruneFeed(db, now);
}

/** Deletes events older than the retention and, beyond the row cap, the oldest ones. Never throws. */
export async function pruneFeed(db: Db, now: number = Date.now()): Promise<void> {
  try {
    await db.delete(feedEvents).where(lt(feedEvents.createdAt, new Date(now - FEED_KEEP_MS)));
    await db.execute(
      sql`delete from feed_events where id in (select id from feed_events order by created_at desc, id desc offset ${LOG_RETENTION_MAX_ROWS})`,
    );
  } catch {
    // Pruning is housekeeping; a failure must not reach a request.
  }
}

const caches = new Map<Db, ReturnType<typeof createTtlCache<CommunityResponse>>>();

/** GET /api/community, cached 10 s per instance. */
export function getCommunity(db: Db, now: number = Date.now()): Promise<CommunityResponse> {
  let cache = caches.get(db);
  if (!cache) {
    cache = createTtlCache((_key, at) => loadCommunity(db, at));
    caches.set(db, cache);
  }
  return cache.get('community', now);
}

/** For tests. */
export function clearCommunityCache(): void {
  caches.clear();
}
