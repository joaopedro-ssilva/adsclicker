/**
 * GET /api/admin/players/[id]/stats: everything the admin may want to know about one player. The
 * account comes from the row; the progress is read from the cloud save itself (the same parse the
 * sync does), so it covers what the projected columns do not: graduations, collection, Maestrias...
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { CounterKey } from '@/game/content/types';
import { clickValue, coinsPerSecond, deserializeState, formatDuration, formatNumber } from '@/game/engine';
import { maestriaLevel } from '@/game/engine/maestria';
import type { GameState } from '@/game/engine/state';
import type { AdminPlayerStats, AdminStatRow } from '@/shared/api';
import type { Db } from '../db/client';
import { hackathonProfiles, players } from '../db/schema';
import type { PlayerRow } from '../db/schema';
import { ApiFailure } from '../http/errors';

type Section = AdminPlayerStats['sections'][number];

const int = (value: number) => formatNumber(value, { integer: true });
const count = (have: number, total: number) => `${int(have)} / ${int(total)}`;
const yesNo = (value: boolean) => (value ? 'Sim' : 'Não');
const moment = (label: string, date: Date): AdminStatRow => ({ label, value: date.toISOString(), at: date.getTime() });
const owned = (record: Record<string, boolean>) => Object.values(record).filter(Boolean).length;

/** The lifetime counters, with the labels of the game's own Estatísticas section. */
const COUNTERS: [CounterKey, string][] = [
  ['clicks', 'Cliques'],
  ['crits', 'Críticos'],
  ['maxCombo', 'Combo máximo'],
  ['levelsBought', 'Níveis comprados'],
  ['biggestPurchase', 'Maior compra (níveis)'],
  ['researchBought', 'Pesquisas feitas'],
  ['eventsDefended', 'Invasões defendidas'],
  ['eventsMissed', 'Invasões perdidas'],
  ['bestEventStreak', 'Melhor sequência de invasões'],
  ['abilitiesUsed', 'Habilidades usadas'],
  ['sprintsCompleted', 'Sprints concluídos'],
  ['sprintsFailed', 'Sprints falhos'],
  ['graduations', 'Formaturas'],
  ['professorSwaps', 'Trocas de professor'],
  ['offlineCollections', 'Ganhos offline'],
  ['bestDayStreak', 'Maior sequência de dias'],
  ['cafesBought', 'Cafés comprados (Hackathon)'],
];

const CARGOS: Record<string, string> = { estudante: 'Estudante', estagiario: 'Estagiário' };

function accountSection(row: Omit<PlayerRow, 'save'>): Section {
  return {
    title: 'Conta',
    rows: [
      { label: 'Id', value: row.id },
      { label: 'Apelido', value: row.nickname ?? 'convidado (sem apelido)' },
      { label: 'Tem senha', value: yesNo(row.passwordHash !== null) },
      moment('Criada em', row.createdAt),
      moment('Último sync', row.lastSeenAt),
      { label: 'Syncs aceitos', value: int(row.rev) },
      { label: 'Multiplicador próprio', value: `×${formatNumber(row.multiplier)}` },
      { label: 'Conta de teste', value: yesNo(row.testAccount) },
      { label: 'Suspeito', value: row.flagged ? `Sim: ${row.flagReason ?? 'sem motivo'}` : 'Não' },
      { label: 'Banido', value: yesNo(row.banned) },
      { label: 'Confiável (anticheat ignorado)', value: yesNo(row.trusted) },
      { label: 'Época de progresso', value: int(row.progressEpoch) },
    ],
  };
}

function progressSections(state: GameState): Section[] {
  const professorsHired = PROFESSOR_IDS.filter((id) => state.hired[id]);
  const prestigeLevels = Object.values(state.prestige).reduce((sum, level) => sum + level, 0);
  const prestigeMax = content.prestigeNodes.reduce((sum, node) => sum + node.maxLevel, 0);
  const honoured = state.honoured ? content.professors[state.honoured].name : 'nenhum';
  const honouredEver = PROFESSOR_IDS.filter((id) => state.honouredBefore[id]).map((id) => content.professors[id].name);

  const progress: Section = {
    title: 'Progresso',
    rows: [
      { label: 'ADScoins na mão', value: formatNumber(state.coins) },
      { label: 'ADScoins nesta turma', value: formatNumber(state.runCoins) },
      { label: 'ADScoins no total', value: formatNumber(state.lifetimeCoins) },
      { label: 'Por segundo', value: formatNumber(coinsPerSecond(state, content)) },
      { label: 'Por clique', value: formatNumber(clickValue(state, content)) },
      { label: 'Turmas formadas', value: int(state.counters.graduations) },
      { label: 'Diplomas ganhos', value: int(state.diplomasEarned) },
      { label: 'Diplomas para gastar', value: int(state.diplomas) },
      { label: 'Tempo de jogo', value: formatDuration(state.counters.playSeconds * 1000) },
      { label: 'Professores contratados', value: count(professorsHired.length, PROFESSOR_IDS.length) },
      { label: 'Professor em cena', value: content.professors[state.activeProfessor].name },
      { label: 'Homenageado agora', value: honoured },
      { label: 'Já homenageados', value: honouredEver.length > 0 ? honouredEver.join(', ') : 'nenhum' },
      { label: 'Pesquisas', value: count(owned(state.research), content.research.length) },
      { label: 'Árvore da Formatura (níveis)', value: count(prestigeLevels, prestigeMax) },
    ],
  };

  const collection: Section = {
    title: 'Coleção',
    rows: [
      { label: 'Conquistas', value: count(Object.keys(state.achievements).length, content.achievements.length) },
      { label: 'Skins', value: count(owned(state.skins), content.skins.length) },
      { label: 'Cenários', value: count(owned(state.sceneries), content.sceneries.length) },
      { label: 'Temas', value: count(owned(state.themes), content.themes.length) },
      { label: 'Segredos descobertos', value: int(owned(state.secrets)) },
    ],
  };

  const maestrias: Section = {
    title: 'Maestrias e monitores',
    rows: [
      ...PROFESSOR_IDS.map((id) => {
        const level = maestriaLevel(state, id);
        return { label: content.maestrias.defs[id].name, value: level > 0 ? `nível ${level}` : 'bloqueada' };
      }),
      ...content.monitors.map((monitor) => {
        const unit = state.monitors.units[monitor.id];
        const times = unit ? `${int(unit.done)} ${unit.done === 1 ? 'vez' : 'vezes'}` : '';
        const value = unit && unit.level > 0 ? `nível ${unit.level}, ${unit.on ? 'ligado' : 'desligado'}, agiu ${times}` : 'não contratado';
        return { label: monitor.name, value };
      }),
    ],
  };

  const counters: Section = {
    title: 'Contadores',
    rows: COUNTERS.map(([key, label]) => ({ label, value: int(state.counters[key] ?? 0) })),
  };

  const run: Section = {
    title: 'Turma atual',
    rows: [
      { label: 'Tempo nesta turma', value: formatDuration(state.run.seconds * 1000) },
      { label: 'Cliques nesta turma', value: int(state.run.clicks) },
      { label: 'Níveis comprados', value: int(state.run.levelsBought) },
      { label: 'Sprints concluídos / falhos', value: `${int(state.run.sprintsCompleted)} / ${int(state.run.sprintsFailed)}` },
      { label: 'Invasões defendidas / perdidas', value: `${int(state.run.eventsDefended)} / ${int(state.run.eventsMissed)}` },
      { label: 'Sequência de dias jogados', value: int(state.calendar.streak) },
    ],
  };

  return [progress, collection, maestrias, counters, run];
}

async function hackathonSection(db: Db, playerId: string): Promise<Section | null> {
  const [profile] = await db.select().from(hackathonProfiles).where(eq(hackathonProfiles.playerId, playerId)).limit(1);
  if (!profile) return null;
  return {
    title: 'Hackathon',
    rows: [
      { label: 'Cargo', value: CARGOS[profile.cargo] ?? profile.cargo },
      { label: 'Nível', value: int(profile.level) },
      { label: 'Commits', value: int(profile.commits) },
      { label: 'Vitórias / derrotas', value: `${int(profile.victories)} / ${int(profile.defeats)}` },
      { label: 'Itens encontrados', value: int(profile.itemsFound) },
      { label: 'Lendários', value: int(profile.legendaries) },
      moment('Começou em', profile.createdAt),
    ],
  };
}

export async function playerStats(db: Db, id: string, now: number = Date.now()): Promise<AdminPlayerStats> {
  if (!z.uuid().safeParse(id).success) throw new ApiFailure('not_found');
  const [row] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!row) throw new ApiFailure('not_found');
  const { save, ...core } = row;
  const state = save !== null ? deserializeState(save, content, now) : null;
  const hackathon = await hackathonSection(db, id);
  return {
    hasSave: state !== null,
    sections: [accountSection(core), ...(state ? progressSections(state) : []), ...(hackathon ? [hackathon] : [])],
  };
}
