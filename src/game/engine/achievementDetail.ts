import { PROFESSOR_IDS } from '../content/types';
import type { AchievementDef, Condition, CounterKey, GameContent } from '../content/types';
import { achievementsDone, bolsaHeld, cleanRunSteps, lastRunValue, measureCondition, monitorsReached, ownedCount, prestigeProgress } from './achievements';
import type { Probe } from './achievements';
import { getIndex } from './contentIndex';
import { parseDecimal } from './decimal';
import { levelOf } from './economy';
import { formatDuration, formatNumber, formatPercent } from './format';
import { horasBandsFilled } from './maestria/horas';
import { releaseVersions } from './maestria/releases';
import { maestriaLevel } from './maestria/slots';
import { masteryRank, postdocStars } from './mastery';
import { totalPostdocStars } from './postdoc';
import type { GameState } from './state';

/** What the Album shows under a locked achievement: a bar, "current / target" and, when useful, the next step. */
export interface ProgressDetail {
  /** 0..1, or null for a secret one. */
  progress: number | null;
  /** "3.214 / 5.000 cliques". Null when the condition is hidden (secret). */
  text: string | null;
  /** The next step when the goal is not a plain counter: what is still missing. */
  note: string | null;
}

const COUNTER_UNIT: Record<CounterKey, string> = {
  clicks: 'cliques',
  crits: 'cliques críticos',
  maxCombo: 'de combo',
  eventsDefended: 'invasões defendidas',
  eventsMissed: 'invasões perdidas',
  bestEventStreak: 'defesas seguidas',
  abilitiesUsed: 'habilidades usadas',
  sprintsCompleted: 'sprints concluídos',
  sprintsFailed: 'sprints perdidos',
  levelsBought: 'níveis comprados',
  researchBought: 'pesquisas compradas',
  graduations: 'formaturas',
  professorSwaps: 'trocas de professor',
  biggestPurchase: 'níveis numa compra só',
  bestDayStreak: 'dias seguidos',
  playSeconds: 'segundos de jogo',
  offlineCollections: 'coletas offline',
  cafesBought: 'cafés comprados',
  goldenModes: 'modos dourados',
  rollforwards: 'Rollforwards usados',
  tripleRollforwards: 'Rollforwards com 3 cargas guardadas',
  swarmsWon: 'Super invasões vencidas',
  swarmsCleared: 'Super invasões limpas',
  festas: 'festas de lançamento',
  bolsaProfitSeconds: 'de lucro na Bolsa',
  designFreeLevels: 'níveis de graça',
  cappedGraduations: 'formaturas no teto de diplomas',
  treeResets: 'resets da árvore',
  postdocs: 'Pós-docs defendidos',
  ungratefulGraduations: 'formaturas sem homenagem',
  donations: 'doações ao campus',
};

const n = (value: number) => formatNumber(Math.floor(value));
const pair = (value: number, target: number, unit: string) => `${n(Math.min(value, target))} / ${n(target)} ${unit}`;

/** "A, B e C" with at most `max` names and a "mais N" tail. */
function nameList(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} e mais ${rest}`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
}

function counterText(state: GameState, counter: CounterKey, target: number): string {
  const value = state.counters[counter];
  if (counter === 'bolsaProfitSeconds') return `${formatDuration(Math.min(value, target) * 1000)} / ${formatDuration(target * 1000)} de produção em lucro`;
  if (counter === 'playSeconds') return `${formatDuration(Math.min(value, target) * 1000)} / ${formatDuration(target * 1000)} de jogo`;
  return pair(value, target, COUNTER_UNIT[counter]);
}

interface Described {
  text: string;
  note: string | null;
}

function describe(state: GameState, content: GameContent, condition: Condition, probe: Probe): Described | null {
  const index = getIndex(content);
  const professorName = (id: keyof typeof content.professors) => content.professors[id].name;
  switch (condition.kind) {
    case 'secret':
      return null;
    case 'counter':
      return { text: counterText(state, condition.counter, condition.gte), note: null };
    case 'lifetimeCoins':
      return { text: `${formatNumber(state.lifetimeCoins)} / ${formatNumber(parseDecimal(condition.gte))} moedas`, note: null };
    case 'coinsPerSecond':
      return { text: `${formatNumber(probe.coinsPerSecond())} / ${formatNumber(parseDecimal(condition.gte))} moedas por segundo`, note: null };
    case 'clickValue':
      return { text: `${formatNumber(probe.clickValue())} / ${formatNumber(parseDecimal(condition.gte))} moedas por clique`, note: null };
    case 'disciplineLevel': {
      const name = index.disciplines.get(condition.discipline)?.name ?? 'a disciplina';
      return { text: `nível ${n(levelOf(state, condition.discipline))} / ${n(condition.level)}`, note: `Suba ${name} até o nível ${n(condition.level)}.` };
    }
    case 'allDisciplinesLevel': {
      const list = index.disciplinesOf[condition.professor];
      const short = list.filter((def) => levelOf(state, def.id) < condition.level);
      const reached = list.reduce((sum, def) => sum + Math.min(levelOf(state, def.id), condition.level), 0);
      return {
        text: `${n(reached)} / ${n(condition.level * list.length)} níveis`,
        note: short.length > 0 ? `Todas de ${professorName(condition.professor)} no nível ${n(condition.level)}. Falta: ${nameList(short.map((def) => def.name))}.` : null,
      };
    }
    case 'professorHired':
      return { text: state.hired[condition.professor] ? 'contratado' : 'não contratado', note: `Contrate ${professorName(condition.professor)}.` };
    case 'professorsHired': {
      const missing = index.professorList.filter((p) => !state.hired[p.id]);
      return {
        text: `${n(index.professorList.length - missing.length)} de ${n(condition.gte)} professores`,
        note: missing.length > 0 ? `Ainda sem contratar: ${nameList(missing.map((p) => p.name))}.` : null,
      };
    }
    case 'allResearch': {
      const list = index.researchOf[condition.professor];
      const missing = list.filter((def) => !state.research[def.id]);
      return {
        text: `${n(list.length - missing.length)} de ${n(list.length)} pesquisas`,
        note: missing.length > 0 ? `Pesquisas de ${professorName(condition.professor)} que faltam: ${nameList(missing.map((def) => def.name))}.` : null,
      };
    }
    case 'diplomasEarned':
      return { text: pair(state.diplomasEarned, condition.gte, 'diplomas'), note: null };
    case 'prestigeNodes': {
      let owned = 0;
      for (const id in state.prestige) if ((state.prestige[id] ?? 0) > 0 && index.prestigeNodes.has(id)) owned += 1;
      return { text: pair(owned, condition.gte, 'melhorias do currículo'), note: null };
    }
    case 'achievements':
      return { text: pair(Object.keys(state.achievements).length, condition.gte, 'conquistas'), note: null };
    case 'skinsOwned': {
      let owned = 0;
      for (const id in state.skins) {
        const skin = index.skins.get(id);
        if (state.skins[id] && skin && (!condition.professor || skin.professor === condition.professor)) owned += 1;
      }
      const who = condition.professor ? ` de ${professorName(condition.professor)}` : '';
      return { text: pair(owned, condition.gte, `skins${who}`), note: null };
    }
    case 'session':
      return { text: `${formatDuration(Math.min(state.session.seconds, condition.gte) * 1000)} / ${formatDuration(condition.gte * 1000)} sem sair`, note: null };
    case 'runCounter':
      return { text: pair(state.run[condition.counter], condition.gte, 'níveis nesta turma'), note: null };
    case 'professorLevels': {
      const levels = index.disciplinesOf[condition.professor].reduce((sum, def) => sum + levelOf(state, def.id), 0);
      return { text: pair(levels, condition.gte, `níveis de ${professorName(condition.professor)}`), note: null };
    }
    case 'mastery': {
      const professors = condition.professor ? [condition.professor] : index.professorList.map((p) => p.id);
      const short = professors.filter((id) => masteryRank(state, content, id) < condition.rank);
      const reached = professors.length - short.length;
      const needed = Math.min(condition.count ?? professors.length, professors.length);
      return {
        text: condition.professor
          ? `domínio ${n(Math.min(masteryRank(state, content, condition.professor), condition.rank))} / ${n(condition.rank)}`
          : `${n(Math.min(reached, needed))} de ${n(needed)} professores no domínio ${n(condition.rank)}`,
        note: !condition.professor && reached < needed ? `Ainda abaixo: ${nameList(short.map((id) => professorName(id)))}.` : null,
      };
    }
    case 'postdoc': {
      const professors = condition.professor ? [condition.professor] : index.professorList.map((p) => p.id);
      const short = professors.filter((id) => postdocStars(state, id) < condition.stars);
      const reached = professors.length - short.length;
      const needed = Math.min(condition.count ?? professors.length, professors.length);
      return {
        text: condition.professor
          ? `${n(Math.min(postdocStars(state, condition.professor), condition.stars))} / ${n(condition.stars)} estrelas de Pós-doc`
          : `${n(Math.min(reached, needed))} de ${n(needed)} professores com ${n(condition.stars)} estrela${condition.stars === 1 ? '' : 's'} de Pós-doc`,
        note: !condition.professor && reached < needed ? `Ainda sem: ${nameList(short.map((id) => professorName(id)))}.` : null,
      };
    }
    case 'postdocTotal':
      return { text: pair(totalPostdocStars(state), condition.gte, 'estrelas de Pós-doc'), note: null };
    case 'alignedLevels': {
      let best = 0;
      for (const professor of index.professorList) {
        const list = index.disciplinesOf[professor.id];
        if (list.length > 0) best = Math.max(best, Math.min(...list.map((def) => levelOf(state, def.id))));
      }
      return { text: `${n(Math.min(best, condition.level))} / ${n(condition.level)} de nível parelho`, note: 'Todas as disciplinas de um professor no mesmo nível, sem nenhuma sobrando.' };
    }
    case 'abilitiesTried': {
      const missing = content.abilities.filter((def) => !state.abilitiesTried[def.id]);
      return {
        text: `${n(content.abilities.length - missing.length)} de ${n(content.abilities.length)} habilidades`,
        note: missing.length > 0 ? `Ainda não usadas: ${nameList(missing.map((def) => def.name))}.` : null,
      };
    }
    case 'abilitiesActive': {
      const idle = content.abilities.filter((def) => !state.buffs.some((buff) => buff.id === def.buff.id && buff.source === 'ability'));
      return {
        text: `${n(content.abilities.length - idle.length)} de ${n(content.abilities.length)} ativas`,
        note: idle.length > 0 ? `Ative tudo ao mesmo tempo, à mão. Falta: ${nameList(idle.map((def) => def.name))}.` : null,
      };
    }
    case 'everyResearch': {
      const missing = content.research.filter((def) => !state.research[def.id]);
      return { text: `${n(content.research.length - missing.length)} de ${n(content.research.length)} pesquisas`, note: 'Todas as pesquisas compradas na mesma turma.' };
    }
    case 'rarityOwned': {
      const list = content.skins.filter((skin) => skin.rarity === condition.rarity);
      const owned = list.filter((skin) => state.skins[skin.id]).length;
      return { text: `${n(owned)} de ${n(list.length)} skins`, note: null };
    }
    case 'honoured': {
      const count = Object.keys(state.honouredBefore).filter((id) => id in content.professors).length;
      return { text: pair(count, condition.gte, 'professores homenageados'), note: null };
    }
    case 'graduationsToday':
      return { text: pair(state.calendar.gradsToday, condition.gte, 'formaturas hoje'), note: null };
    case 'lastRun': {
      const last = state.lastRun;
      const unit = condition.metric === 'seconds' ? '' : condition.metric === 'clicks' ? ' cliques' : ' professores investidos';
      const show = (value: number) => (condition.metric === 'seconds' ? formatDuration(value * 1000) : `${n(value)}${unit}`);
      if (!last) return { text: `no máximo ${show(condition.lte)}`, note: 'Vale a turma que acabou de se formar.' };
      const value = lastRunValue(last, condition.metric);
      return {
        text: `última turma: ${show(value)} (limite ${show(condition.lte)})`,
        note: value > condition.lte ? `Faltou baixar ${show(value - condition.lte)} na próxima formatura.` : null,
      };
    }
    case 'lastRunClickShare': {
      const share = state.lastRun?.clickShare ?? 0;
      return {
        text: `${formatPercent(share)} / ${formatPercent(condition.gte)} das moedas vindas de clique`,
        note: 'Vale a turma que acabou de se formar.',
      };
    }
    case 'lastRunClean': {
      const last = state.lastRun;
      const steps = last ? cleanRunSteps(last) : [false, false, false, false];
      const labels = ['nenhum sprint perdido', 'nenhuma invasão perdida', 'um sprint concluído', 'uma invasão defendida'];
      const missing = labels.filter((_, i) => !steps[i]);
      return {
        text: `${n(4 - missing.length)} de 4 itens da turma`,
        note: last ? (missing.length > 0 ? `Na última turma faltou: ${nameList(missing, 4)}.` : null) : 'Vale a turma que acabou de se formar.',
      };
    }
    case 'maestrias': {
      const needed = condition.level ?? 1;
      const count = PROFESSOR_IDS.filter((id) => maestriaLevel(state, id) >= needed).length;
      const level = needed > 1 ? ` no nível ${n(needed)}` : '';
      return { text: `${n(Math.min(count, condition.unlocked))} de ${n(condition.unlocked)} Maestrias${level}`, note: null };
    }
    case 'everyOwned': {
      const { owned, total } = ownedCount(state, content, condition.of, condition.except);
      const unit = condition.of === 'sceneries' ? 'cenários' : 'temas';
      const list = (condition.of === 'sceneries' ? content.sceneries : content.themes).filter((item) => !(condition.except ?? []).includes(item.id));
      const have = condition.of === 'sceneries' ? state.sceneries : state.themes;
      const missing = list.filter((item) => !have[item.id]);
      return { text: pair(owned, total, unit), note: missing.length > 0 ? `Ainda falta: ${nameList(missing.map((item) => item.name))}.` : null };
    }
    case 'everyAchievement': {
      const { done, total } = achievementsDone(state, content, condition.except);
      return { text: pair(done, total, 'conquistas'), note: 'Todas as outras conquistas do jogo, as secretas também.' };
    }
    case 'prestigeComplete': {
      const { levels, total } = prestigeProgress(state, content);
      const open = content.prestigeNodes.filter((node) => (state.prestige[node.id] ?? 0) < node.maxLevel);
      return { text: pair(levels, total, 'níveis da árvore'), note: open.length > 0 ? `Falta evoluir: ${nameList(open.map((node) => node.name))}.` : null };
    }
    case 'releaseVersions':
      return { text: `versão ${n(Math.min(releaseVersions(state, content), condition.gte))}.0 / ${n(condition.gte)}.0 nesta turma`, note: 'Vale a turma em andamento: ao se formar, as versões voltam ao zero.' };
    case 'horasBands':
      return { text: pair(horasBandsFilled(state, content), condition.gte, 'faixas de horas nesta turma'), note: 'Vale a turma em andamento e exige a Maestria do Angelo no nível máximo.' };
    case 'bolsaPortfolio': {
      const { held, total } = bolsaHeld(state, content);
      return { text: pair(held, total, 'investimentos em carteira'), note: 'Os quatro ativos e o Fundo, todos com dinheiro aplicado ao mesmo tempo.' };
    }
    case 'monitors':
      return {
        text: pair(monitorsReached(state, content, condition.maxed === true), condition.gte, condition.maxed ? 'monitores no nível máximo' : 'monitores contratados'),
        note: null,
      };
  }
}

/** Progress and the "o que falta" text of one achievement. Locked secrets reveal nothing. */
export function achievementDetail(state: GameState, content: GameContent, def: AchievementDef, probe: Probe): ProgressDetail {
  if (def.condition.kind === 'secret') return { progress: null, text: null, note: null };
  if (state.achievements[def.id] !== undefined) return { progress: 1, text: null, note: null };
  const measure = measureCondition(state, content, def.condition, probe);
  const described = describe(state, content, def.condition, probe);
  return { progress: measure.progress, text: described?.text ?? null, note: described?.note ?? null };
}
