/**
 * Pure helpers of the Laboratório screen: text of affixes, art paths, the state of the cracks and the records table.
 * Nothing here reads the store, so it is all covered by labFormat.test.ts.
 */
import type { LabSlot } from '@/game/content/labTypes';
import type { GameContent } from '@/game/content/types';
import type { LabCounters } from '@/game/engine/lab/types';
import type { LabLine, LabSlotView } from '@/game/engine/views';
import type { GameEvent } from '@/game/store';
import { fmtInt } from '../panel/lib/numbers';

export const SLOT_LABEL: Record<LabSlot, string> = {
  ferramenta: 'Ferramenta',
  setup: 'Setup',
  acessorio: 'Acessório',
  amuleto: 'Amuleto',
};

/** One line under the slot name that says what the slot holds. */
export const SLOT_HINT: Record<LabSlot, string> = {
  ferramenta: 'Dá o dano base da pesquisa.',
  setup: 'O ambiente de trabalho.',
  acessorio: 'Pequenos extras.',
  amuleto: 'Sorte e efeitos raros.',
};

// ---------------------------------------------------------------------------
// Item art
// ---------------------------------------------------------------------------

/** URL of the picture of an item (public/assets/hackathon/items/<id>.png). `asset` is the base's content path. */
export function itemArtSrc(asset: string): string {
  return `/assets/${asset}.png`;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Labels that start with a proper name and keep their capital in the middle of a sentence. */
const KEEP_CAPITAL = /^(ADS|Commits)/;

/** "+12%" and "ADScoins por clique" become "+12% ADScoins por clique"; "Dano automático" becomes "+20% dano automático". */
export function affixText(line: LabLine): string {
  const label = KEEP_CAPITAL.test(line.label) ? line.label : line.label.charAt(0).toLowerCase() + line.label.slice(1);
  return `${line.text} ${label}`;
}

/** Splits the lines of an item or buff into what it does for the clicker and what only the Laboratório uses. */
export function splitLines(content: GameContent, lines: readonly LabLine[]): { clicker: LabLine[]; lab: LabLine[] } {
  const clickerLabels = new Set(Object.values(content.lab.labels.stats));
  const clicker: LabLine[] = [];
  const lab: LabLine[] = [];
  for (const line of lines) (clickerLabels.has(line.label) ? clicker : lab).push(line);
  return { clicker, lab };
}

/** Seconds with one decimal, pt-BR: "23,4 s". */
export function seconds(value: number): string {
  return `${(Math.max(0, value)).toFixed(1).replace('.', ',')} s`;
}

/** A rate with the right precision for small numbers: "0,4", "12,3", "1.234". */
export function perSecond(value: number): string {
  if (value >= 1000) return fmtInt(value);
  if (value >= 100) return String(Math.round(value));
  return value.toFixed(value >= 10 ? 1 : 2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// The monitor
// ---------------------------------------------------------------------------

/** 0 (intact) to 4 (broken): how many cracks the glass shows. */
export function crackLevel(fraction: number, broken: boolean): 0 | 1 | 2 | 3 | 4 {
  if (broken) return 4;
  if (fraction <= 0.25) return 3;
  if (fraction <= 0.5) return 2;
  if (fraction <= 0.75) return 1;
  return 0;
}

export function integrityTone(fraction: number): 'good' | 'warn' | 'bad' {
  if (fraction <= 0.25) return 'bad';
  if (fraction <= 0.5) return 'warn';
  return 'good';
}

/** Zoom of the mob sprites so a full wave still fits the screen: few mobs get big, many get small. */
export function mobZoom(count: number): number {
  if (count <= 2) return 3;
  if (count <= 4) return 2.4;
  return 1.8;
}

// ---------------------------------------------------------------------------
// The 9th slot
// ---------------------------------------------------------------------------

export interface LabEntryInfo {
  unlocked: boolean;
  /** The run and the bench can be used in this turma. */
  ok: boolean;
  /** Why not ("Faltam 5 aulas"), when it cannot. */
  reason: string | null;
  hasRun: boolean;
  status: 'fighting' | 'reward' | 'equip' | 'broken' | 'none';
  phase: number;
}

/** What the slot shows under the name: where the run stands, or why it cannot start. */
export function entryCaption(info: LabEntryInfo): string {
  if (!info.unlocked) return 'Trancado';
  if (!info.ok) return info.reason ?? 'Indisponível';
  if (!info.hasRun) return 'Iniciar pesquisa';
  if (info.status === 'broken') return 'Monitor quebrado';
  if (info.status === 'reward' || info.status === 'equip') return `Fase ${info.phase}: escolha`;
  return `Fase ${info.phase}`;
}

/** The run is waiting for the player, or can be started: the slot calls attention. */
export function entryNeedsAttention(info: LabEntryInfo): boolean {
  if (!info.unlocked || !info.ok) return false;
  return !info.hasRun || info.status === 'reward' || info.status === 'equip';
}

export function entryInfo(view: LabSlotView, status: LabEntryInfo['status'], phase: number): LabEntryInfo {
  return { unlocked: view.unlocked, ok: view.available.ok, reason: view.available.reason, hasRun: view.hasRun, status, phase };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface RecordRow {
  label: string;
  value: string;
}

export function recordRows(counters: LabCounters, bestPhase: number, treeSpent: number): RecordRow[] {
  return [
    { label: 'Fase mais alta', value: bestPhase > 0 ? fmtInt(bestPhase) : '-' },
    { label: 'Pesquisas iniciadas', value: fmtInt(counters.runs) },
    { label: 'Monitores quebrados', value: fmtInt(counters.broken) },
    { label: 'Fases vencidas', value: fmtInt(counters.phasesCleared) },
    { label: 'Chefões derrotados', value: fmtInt(counters.bossesBeaten) },
    { label: 'Itens encontrados', value: fmtInt(counters.itemsFound) },
    { label: 'Itens reciclados', value: fmtInt(counters.itemsRecycled) },
    { label: 'Níveis de item comprados', value: fmtInt(counters.itemLevelUps) },
    { label: 'Atributos sorteados', value: fmtInt(counters.affixRerolls) },
    { label: 'Cliques no monitor', value: fmtInt(counters.clicks) },
    { label: 'Commits ganhos', value: fmtInt(counters.commitsEarned) },
    { label: 'Commits gastos na árvore', value: fmtInt(treeSpent) },
  ];
}

// ---------------------------------------------------------------------------
// The little feed on the monitor
// ---------------------------------------------------------------------------

export const FEED_EVENTS = ['labPhaseCleared', 'labItemGained', 'labItemRecycled', 'labItemChanged'] as const;

/** The line the monitor flashes for an event, or null for the ones it ignores. */
export function feedText(content: GameContent, event: GameEvent): string | null {
  const baseName = (id: string) => content.lab.bases.find((base) => base.id === id)?.name ?? id;
  const rarityName = (id: string) => content.lab.rarities.find((rarity) => rarity.id === id)?.name ?? id;
  switch (event.type) {
    case 'labPhaseCleared':
      return event.boss ? `Chefão da fase ${event.phase} derrotado` : `Fase ${event.phase} concluída`;
    case 'labItemGained':
      return `Novo item: ${baseName(event.item)} (${rarityName(event.rarity).toLowerCase()})`;
    case 'labItemRecycled':
      return `${baseName(event.item)} reciclado em Commits`;
    case 'labItemChanged':
      return event.action === 'levelUp' ? `${baseName(event.item)} subiu para o nível ${event.level}` : `Atributo de ${baseName(event.item)} sorteado`;
    default:
      return null;
  }
}
