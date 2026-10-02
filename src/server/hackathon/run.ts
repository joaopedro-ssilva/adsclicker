import { randomInt } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { TICK_MS } from '@/hackathon/engine/types';
import type { Build, ResolvedStage, RunOutcome, RunSetup } from '@/hackathon/engine/types';
import { buildSchema, resolvedStageSchema } from '@/shared/hackathonApi';
import type { RunFinishRequest, RunFinishResponse, RunRewards, RunStartRequest, RunStartResponse } from '@/shared/hackathonApi';
import { feedEvents, hackathonCollection, hackathonItems, hackathonProfiles, hackathonRuns } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { isRanked } from '../players/summary';
import { storeBestItem } from './balance';
import { spendCafe } from './cafe';
import { NO_PROFILE_MESSAGE, profileIn } from './context';
import type { HackathonContext } from './context';
import { dateKeyOf } from './dates';
import { assertReady } from './deps';
import { MAX_COMMITS, MAX_XP, addCapped } from './limits';
import { baseRewards, fitInventory, promotionFor } from './rewards';
import { itemToRow, loadItems, loadStageClears, lockProfile, recordClear } from './store';
import type { Tx } from './store';
import { stageLock } from './unlock';
import { asCargo, buildInputOf } from './view';

const DAILY_ID = 'daily';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const forbidden = (message: string): ApiFailure => new ApiFailure('forbidden', message);

/** POST /api/hackathon/run/start */
export async function startRun(ctx: HackathonContext, request: RunStartRequest): Promise<RunStartResponse> {
  assertReady(ctx.deps);
  const { engine, content } = ctx.deps;
  const { now } = ctx;

  const stage = engine.resolveStage(request.stageId, dateKeyOf(now), content);
  if (!stage) throw new ApiFailure('not_found', 'Fase não encontrada.');

  return ctx.db.transaction(async (tx) => {
    const row = await lockProfile(tx, ctx.player.id);
    if (!row) throw new ApiFailure('not_found', NO_PROFILE_MESSAGE);

    // The daily stage is open to every student; a campaign stage needs its level and the previous win.
    if (request.stageId !== DAILY_ID) {
      const def = content.stages.find((candidate) => candidate.id === request.stageId);
      if (!def) throw new ApiFailure('not_found', 'Fase não encontrada.');
      const lock = stageLock(def, row.level, await loadStageClears(tx, ctx.player.id), content);
      if (lock !== null) throw forbidden(lock);
    }

    const cafe = spendCafe({ count: row.cafeCount, at: row.cafeAt.getTime() }, now, content.config.cafe);
    if (!cafe) throw forbidden('Você está sem Café. Espere ele voltar ou compre mais na sala de aula.');

    // A student has one open run: starting another gives the previous one up.
    await tx
      .update(hackathonRuns)
      .set({ status: 'abandoned', finishedAt: new Date(now) })
      .where(and(eq(hackathonRuns.playerId, ctx.player.id), eq(hackathonRuns.status, 'open')));

    const items = await loadItems(tx, ctx.player.id);
    const build = engine.computeBuild(buildInputOf(row, items, ctx.deps), content);
    const seed = randomInt(0, 2 ** 32);
    const runId = ctx.deps.newId();

    await tx.insert(hackathonRuns).values({
      id: runId,
      playerId: ctx.player.id,
      stageId: request.stageId,
      seed,
      auto: request.auto,
      build,
      stage,
      status: 'open',
      startedAt: new Date(now),
    });
    await tx
      .update(hackathonProfiles)
      .set({ cafeCount: cafe.count, cafeAt: new Date(cafe.at) })
      .where(eq(hackathonProfiles.playerId, ctx.player.id));

    return { runId, seed, auto: request.auto, build, stage, profile: await profileIn(tx, ctx) };
  });
}

type Finished = { kind: 'paid'; response: RunFinishResponse } | { kind: 'tooFast' } | { kind: 'gone' };

/** POST /api/hackathon/run/finish */
export async function finishRun(ctx: HackathonContext, request: RunFinishRequest): Promise<RunFinishResponse> {
  assertReady(ctx.deps);
  const { engine, content } = ctx.deps;
  const { now } = ctx;
  if (!UUID.test(request.runId)) throw new ApiFailure('not_found', 'Partida não encontrada.');

  const [run] = await ctx.db
    .select()
    .from(hackathonRuns)
    .where(and(eq(hackathonRuns.id, request.runId), eq(hackathonRuns.playerId, ctx.player.id)))
    .limit(1);
  if (!run) throw new ApiFailure('not_found', 'Partida não encontrada.');
  if (run.status !== 'open') throw forbidden('Esta partida já foi encerrada.');

  const expiresAt = run.startedAt.getTime() + content.config.runExpiryMinutes * 60_000;
  if (now > expiresAt) {
    await ctx.db
      .update(hackathonRuns)
      .set({ status: 'expired', finishedAt: new Date(now) })
      .where(and(eq(hackathonRuns.id, run.id), eq(hackathonRuns.status, 'open')));
    throw forbidden('Esta partida expirou. Comece a fase de novo.');
  }

  // The fight is replayed from the snapshot taken at the start, with the actions the client reports.
  const build: Build = buildSchema.parse(run.build);
  const stage: ResolvedStage = resolvedStageSchema.parse(run.stage);
  const setup: RunSetup = { seed: run.seed, build, stage, auto: run.auto };
  const outcome = engine.simulateRun(setup, request.actions, content);

  const elapsed = now - run.startedAt.getTime();
  const tooFast = elapsed < outcome.ticks * TICK_MS * content.config.minRunTimeShare;

  const result = await ctx.db.transaction(async (tx): Promise<Finished> => {
    // Lock order is always profile first, then the run (startRun does the same).
    const row = await lockProfile(tx, ctx.player.id);
    if (!row) throw new ApiFailure('not_found', NO_PROFILE_MESSAGE);

    // The conditional update is the one-way door: only one finish can move the run out of 'open'.
    const claimed = await tx
      .update(hackathonRuns)
      .set({ status: 'finished', finishedAt: new Date(now) })
      .where(and(eq(hackathonRuns.id, run.id), eq(hackathonRuns.playerId, ctx.player.id), eq(hackathonRuns.status, 'open')))
      .returning({ id: hackathonRuns.id });
    if (claimed.length === 0) return { kind: 'gone' };

    if (tooFast) {
      await tx
        .update(hackathonProfiles)
        .set({ defeats: row.defeats + 1 })
        .where(eq(hackathonProfiles.playerId, ctx.player.id));
      return { kind: 'tooFast' };
    }
    return { kind: 'paid', response: await pay(tx, ctx, { row, run, stage, build, outcome }) };
  });

  if (result.kind === 'gone') throw forbidden('Esta partida já foi encerrada.');
  if (result.kind === 'tooFast') throw forbidden('Partida rápida demais: ela foi contada como derrota e não rendeu recompensas.');
  return result.response;
}

interface PayInput {
  row: NonNullable<Awaited<ReturnType<typeof lockProfile>>>;
  run: typeof hackathonRuns.$inferSelect;
  stage: ResolvedStage;
  build: Build;
  outcome: RunOutcome;
}

/** Everything a finished run changes, inside the finishing transaction. */
async function pay(tx: Tx, ctx: HackathonContext, input: PayInput): Promise<RunFinishResponse> {
  const { engine, content } = ctx.deps;
  const { row, run, stage, build, outcome } = input;
  const playerId = ctx.player.id;
  const won = outcome.won;
  const isDaily = run.stageId === DAILY_ID;
  const at = new Date(ctx.now);

  let firstClear = false;
  if (won && !isDaily) firstClear = (await recordClear(tx, playerId, run.stageId, at)).first;

  const base = baseRewards({ won, stage, build, firstClear, content });

  const owned = await loadItems(tx, playerId);
  const drop = won
    ? engine.rollDrops({ stage, build, firstClear, pity: row.pity, rng: ctx.deps.rng, now: ctx.now, newId: ctx.deps.newId }, content)
    : { items: [], pity: row.pity };
  const fit = fitInventory(drop.items, owned.length, content.config.inventorySize, (item) => engine.recycleValue(item, content));

  // A first victory in the promotion stage promotes first, so the XP of that same win counts under the new cargo's cap.
  const cargo = asCargo(row.cargo, ctx.deps);
  const promotedTo = promotionFor(content, cargo, run.stageId, won, firstClear);
  const progress = engine.applyXp({ cargo: promotedTo ?? cargo, level: row.level, xp: row.xp }, base.xp, content);

  if (fit.kept.length > 0) await tx.insert(hackathonItems).values(fit.kept.map((item) => itemToRow(playerId, item)));
  if (drop.items.length > 0) {
    await tx
      .insert(hackathonCollection)
      .values([...new Set(drop.items.map((item) => item.base))].map((itemBase) => ({ playerId, base: itemBase, foundAt: at })))
      .onConflictDoNothing();
  }

  const dateKey = dateKeyOf(run.startedAt.getTime());
  const legendaries = drop.items.filter((item) => item.rarity === 'lendario');
  await tx
    .update(hackathonProfiles)
    .set({
      cargo: promotedTo ?? cargo,
      level: progress.level,
      xp: Math.min(MAX_XP, progress.xp),
      commits: addCapped(row.commits, base.commits + fit.recycledCommits, MAX_COMMITS),
      pity: drop.pity,
      victories: row.victories + (won ? 1 : 0),
      defeats: row.defeats + (won ? 0 : 1),
      itemsFound: row.itemsFound + drop.items.length,
      legendaries: row.legendaries + legendaries.length,
      ...(won && isDaily ? { dailyDay: dateKey, dailyClears: (row.dailyDay === dateKey ? row.dailyClears : 0) + 1 } : {}),
    })
    .where(eq(hackathonProfiles.playerId, playerId));

  if (fit.kept.length > 0) await storeBestItem(tx, playerId, [...owned, ...fit.kept], ctx.deps);

  if (isRanked(ctx.player)) {
    const events = [
      ...legendaries.map((item) => ({ playerId, kind: 'item', detail: item.base })),
      ...(promotedTo ? [{ playerId, kind: 'promotion', detail: promotedTo }] : []),
    ];
    // The feed's unique key (player, kind, detail) keeps each of these to one announcement.
    if (events.length > 0) await tx.insert(feedEvents).values(events).onConflictDoNothing();
  }

  const rewards: RunRewards = {
    xp: base.xp,
    commits: base.commits,
    items: fit.kept,
    recycledCommits: fit.recycledCommits,
    levelsGained: progress.levelsGained,
    promotedTo,
    firstClear,
  };
  return {
    outcome: {
      won: outcome.won,
      reason: outcome.reason,
      wavesCleared: outcome.wavesCleared,
      ticks: outcome.ticks,
      hpLeft: outcome.hpLeft,
    },
    rewards,
    profile: await profileIn(tx, ctx),
  };
}
