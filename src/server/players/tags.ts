import { and, asc, eq, isNotNull, like, ne, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  AdminTag,
  AdminTagCreate,
  AdminTagDeleteResponse,
  AdminTagPatch,
  AdminTagResponse,
  AdminTagsResponse,
  AdminTurmaZeroPreview,
  AdminTurmaZeroResult,
  PublicTag,
} from '@/shared/api';
import { MAX_TAGS, TURMA_ZERO_TAG, tagSlug } from '@/shared/tags';
import { createTtlCache } from '../community/cache';
import type { TtlCache } from '../community/cache';
import type { Db } from '../db/client';
import { isUniqueViolation } from '../db/client';
import { playerTags, players } from '../db/schema';
import type { PlayerTagRow } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { logEvent } from '../logs/log';

// --- The catalogue -------------------------------------------------------------------------------

/** Every tag, highest priority first. */
export function loadTags(db: Pick<Db, 'select'>): Promise<PlayerTagRow[]> {
  return db.select().from(playerTags).orderBy(asc(playerTags.position), asc(playerTags.createdAt), asc(playerTags.id));
}

/** Per-instance cache for the public reads (boards, feed, sync answers): one query per 10 s, like the boards. */
const catalogs = new Map<Db, TtlCache<PlayerTagRow[]>>();

export function getTagCatalog(db: Db, now: number = Date.now()): Promise<PlayerTagRow[]> {
  let cache = catalogs.get(db);
  if (!cache) {
    cache = createTtlCache(() => loadTags(db));
    catalogs.set(db, cache);
  }
  return cache.get('all', now);
}

/** Called after every admin change, so this instance shows it at once. For tests too. */
export function clearTagCache(): void {
  catalogs.clear();
}

/** The public tags among `held`, in catalogue order, or undefined when none (a player without tags adds nothing to a payload). */
export function publicTagsOf(catalog: readonly PlayerTagRow[], held: readonly string[] | null | undefined): PublicTag[] | undefined {
  if (!held || held.length === 0) return undefined;
  const set = new Set(held);
  const tags = catalog
    .filter((tag) => tag.visibility === 'public' && set.has(tag.id))
    .map((tag) => ({ id: tag.id, label: tag.label, description: tag.description, color: tag.color }));
  return tags.length > 0 ? tags : undefined;
}

/** The ids among `held` the catalogue knows (public and admin-only), in catalogue order. Ids of deleted tags are dropped. */
export function tagIdsOf(catalog: readonly PlayerTagRow[], held: readonly string[] | null | undefined): string[] {
  if (!held || held.length === 0) return [];
  const set = new Set(held);
  return catalog.filter((tag) => set.has(tag.id)).map((tag) => tag.id);
}

// --- Holding a tag -------------------------------------------------------------------------------

/** `titles` after granting `id`: unchanged when already held. Idempotent. */
export const grantTagSql = (id: string): SQL =>
  sql`case when ${id}::text = any(${players.titles}) then ${players.titles} else array_append(${players.titles}, ${id}::text) end`;

/** `titles` after taking `id` away. Idempotent. */
export const revokeTagSql = (id: string): SQL => sql`array_remove(${players.titles}, ${id}::text)`;

const holds = (id: string) => sql`${id}::text = any(${players.titles})`;

async function findTag(db: Pick<Db, 'select'>, id: string): Promise<PlayerTagRow | undefined> {
  const [tag] = await db.select().from(playerTags).where(eq(playerTags.id, id)).limit(1);
  return tag;
}

/** The tag, or a readable refusal when it does not exist (deleted in another tab, or a made-up id). */
export async function requireTag(db: Pick<Db, 'select'>, id: string): Promise<PlayerTagRow> {
  const tag = await findTag(db, id);
  if (!tag) throw new ApiFailure('invalid', 'Essa tag não existe (foi apagada?). Atualize a página.');
  return tag;
}

/** Throws when granting `tag` would give a single-holder tag to a second player. */
export async function assertTagFree(db: Db, tag: PlayerTagRow, playerId: string): Promise<void> {
  if (!tag.single) return;
  const [holder] = await db
    .select({ nickname: players.nickname, id: players.id })
    .from(players)
    .where(and(holds(tag.id), ne(players.id, playerId)))
    .limit(1);
  if (holder) {
    const who = holder.nickname ?? holder.id.slice(0, 8);
    throw new ApiFailure('invalid', `A tag "${tag.label}" já pertence a ${who}. Remova-a dele antes.`);
  }
}

// --- Admin: the catalogue ------------------------------------------------------------------------

// Spelled out with table names: inside a select from player_tags, Drizzle would print both ids as a bare "id".
const holdersSql = sql<number>`(select count(*) from players as holder where player_tags.id = any(holder.titles))::int`;

function toAdminTag(row: PlayerTagRow, holders: number): AdminTag {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    color: row.color,
    visibility: row.visibility === 'admin' ? 'admin' : 'public',
    single: row.single,
    holders,
  };
}

async function adminTag(db: Db, id: string): Promise<AdminTag> {
  const [row] = await db.select({ tag: playerTags, holders: holdersSql }).from(playerTags).where(eq(playerTags.id, id)).limit(1);
  if (!row) throw new ApiFailure('not_found');
  return toAdminTag(row.tag, row.holders);
}

/** GET /api/admin/tags: the catalogue, with how many players hold each tag. */
export async function listAdminTags(db: Db): Promise<AdminTagsResponse> {
  const rows = await db
    .select({ tag: playerTags, holders: holdersSql })
    .from(playerTags)
    .orderBy(asc(playerTags.position), asc(playerTags.createdAt), asc(playerTags.id));
  return { tags: rows.map((row) => toAdminTag(row.tag, row.holders)) };
}

/** A free id for a new tag: its slug, or the slug with -2, -3... */
async function freeId(db: Db, label: string): Promise<string> {
  const slug = tagSlug(label);
  const taken = new Set(
    (await db.select({ id: playerTags.id }).from(playerTags).where(or(eq(playerTags.id, slug), like(playerTags.id, `${slug}-%`)))).map(
      (row) => row.id,
    ),
  );
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
}

/** POST /api/admin/tags: a new tag, last in priority. */
export async function createTag(db: Db, input: AdminTagCreate): Promise<AdminTagResponse> {
  const [stats] = await db
    .select({ count: sql<number>`count(*)::int`, last: sql<number>`coalesce(max(${playerTags.position}), -1)::int` })
    .from(playerTags);
  if ((stats?.count ?? 0) >= MAX_TAGS) throw new ApiFailure('invalid', `Limite de ${MAX_TAGS} tags. Apague uma antes de criar outra.`);
  const values = {
    label: input.label,
    description: input.description ?? '',
    color: input.color,
    visibility: input.visibility,
    single: input.single ?? false,
    position: (stats?.last ?? -1) + 1,
  };
  // Two admins creating the same name at once: the loser takes the next suffix.
  for (let attempt = 0; ; attempt += 1) {
    const id = await freeId(db, input.label);
    try {
      await db.insert(playerTags).values({ id, ...values });
      clearTagCache();
      logEvent(db, { level: 'info', kind: 'admin_tag_create', message: `Tag criada: ${values.label}`, route: '/api/admin/tags', detail: { id, ...values } });
      return { tag: await adminTag(db, id) };
    } catch (error) {
      if (attempt < 3 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

/** POST /api/admin/tags/[id]: edits any of the fields. Making a tag single-holder needs at most one holder. */
export async function updateTag(db: Db, id: string, patch: AdminTagPatch): Promise<AdminTagResponse> {
  const tag = await requireTag(db, id);
  if (patch.single && !tag.single) {
    const current = await adminTag(db, id);
    if (current.holders > 1) {
      throw new ApiFailure('invalid', `${current.holders} jogadores têm esta tag: deixe só um antes de torná-la exclusiva.`);
    }
  }
  const set = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  if (Object.keys(set).length > 0) {
    await db.update(playerTags).set(set).where(eq(playerTags.id, id));
    clearTagCache();
    logEvent(db, { level: 'info', kind: 'admin_tag_update', message: `Tag editada: ${patch.label ?? tag.label}`, route: '/api/admin/tags/[id]', detail: { id, ...set } });
  }
  return { tag: await adminTag(db, id) };
}

/** DELETE /api/admin/tags/[id]: the tag goes, and every player loses it, in one transaction. */
export async function deleteTag(db: Db, id: string): Promise<AdminTagDeleteResponse> {
  const tag = await requireTag(db, id);
  const removedFrom = await db.transaction(async (tx) => {
    const touched = await tx.update(players).set({ titles: revokeTagSql(id) }).where(holds(id)).returning({ id: players.id });
    await tx.delete(playerTags).where(eq(playerTags.id, id));
    return touched.length;
  });
  clearTagCache();
  logEvent(db, {
    level: 'info',
    kind: 'admin_tag_delete',
    message: `Tag apagada: ${tag.label} (tirada de ${removedFrom})`,
    route: '/api/admin/tags/[id]',
    detail: { id, label: tag.label, removedFrom },
  });
  return { removedFrom };
}

// --- Turma Zero in bulk --------------------------------------------------------------------------

/**
 * Turma Zero is for the accounts that played the test phase: a nickname (so they are on the
 * boards) and at least one accepted sync (`rev > 0`, so they played).
 */
const testPhaseAccount = () => and(isNotNull(players.nickname), sql`${players.rev} > 0`);

const TURMA_ZERO_GONE = 'A tag "Turma Zero" foi apagada. Crie-a de novo para usar esta ferramenta.';

/** What "Dar Turma Zero a todos os jogadores atuais" would do right now. */
export async function turmaZeroPreview(db: Db): Promise<AdminTurmaZeroPreview> {
  if (!(await findTag(db, TURMA_ZERO_TAG))) throw new ApiFailure('invalid', TURMA_ZERO_GONE);
  const [row] = await db
    .select({
      eligible: sql<number>`count(*)::int`,
      alreadyHave: sql<number>`(count(*) filter (where ${holds(TURMA_ZERO_TAG)}))::int`,
    })
    .from(players)
    .where(testPhaseAccount());
  const eligible = row?.eligible ?? 0;
  const alreadyHave = row?.alreadyHave ?? 0;
  return { eligible, alreadyHave, toGrant: eligible - alreadyHave };
}

/** Gives Turma Zero to every eligible account that lacks it, in one statement. Safe to repeat: a second run grants 0. */
export async function grantTurmaZeroToAll(db: Db): Promise<AdminTurmaZeroResult> {
  if (!(await findTag(db, TURMA_ZERO_TAG))) throw new ApiFailure('invalid', TURMA_ZERO_GONE);
  const granted = await db
    .update(players)
    .set({ titles: grantTagSql(TURMA_ZERO_TAG) })
    .where(and(testPhaseAccount(), sql`not ${holds(TURMA_ZERO_TAG)}`))
    .returning({ id: players.id });
  const after = await turmaZeroPreview(db);
  const result = { granted: granted.length, alreadyHad: Math.max(0, after.alreadyHave - granted.length) };
  logEvent(db, {
    level: 'info',
    kind: 'admin_turma_zero',
    message: `Turma Zero em massa: ${result.granted} concedidos.`,
    route: '/api/admin/titles/turma-zero',
    detail: result,
  });
  return result;
}

/**
 * Accounts eligible for Turma Zero that do not hold it (shown as a warning before the launch reset, which resets `rev`).
 * 0 when the tag was deleted: there is nothing left to warn about.
 */
export async function countWithoutTurmaZero(db: Pick<Db, 'select'>): Promise<number> {
  if (!(await findTag(db, TURMA_ZERO_TAG))) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .where(and(testPhaseAccount(), sql`not ${holds(TURMA_ZERO_TAG)}`));
  return row?.n ?? 0;
}
