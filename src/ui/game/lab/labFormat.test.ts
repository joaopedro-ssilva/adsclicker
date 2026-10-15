import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { createLabCounters } from '@/game/engine/lab/state';
import {
  affixText,
  crackLevel,
  entryCaption,
  entryNeedsAttention,
  feedText,
  integrityTone,
  itemArtSrc,
  mobZoom,
  perSecond,
  nodeForest,
  nodeState,
  recordSections,
  seconds,
  splitLines,
} from './labFormat';
import type { LabEntryInfo } from './labFormat';

const entry = (extra: Partial<LabEntryInfo> = {}): LabEntryInfo => ({
  unlocked: true,
  ok: true,
  reason: null,
  hasRun: false,
  status: 'none',
  phase: 0,
  ...extra,
});

describe('affix text', () => {
  it('writes an affix as its effect on the clicker', () => {
    expect(affixText({ label: 'ADScoins por clique', text: '+12%' })).toBe('+12% ADScoins por clique');
    expect(affixText({ label: 'Chance de crítico', text: '+5%' })).toBe('+5% chance de crítico');
    expect(affixText({ label: 'Commits', text: '+8%' })).toBe('+8% Commits');
  });

  it('tells the clicker lines from the lab-only ones by the stat labels of the content', () => {
    const { clicker, lab } = splitLines(content, [
      { label: 'ADScoins por clique', text: '+12%' },
      { label: 'Sorte', text: '+5' },
      { label: 'Dano automático', text: '+20%' },
    ]);
    expect(clicker.map((line) => line.label)).toEqual(['ADScoins por clique']);
    expect(lab.map((line) => line.label)).toEqual(['Sorte', 'Dano automático']);
  });
});

describe('art', () => {
  it('points every item base at a PNG that exists in the manifest of the art', async () => {
    const { ASSETS } = await import('@/ui/art/manifest');
    for (const base of content.lab.bases) expect(ASSETS[base.asset], base.id).toBeDefined();
    expect(itemArtSrc('hackathon/items/mouse-quebrado')).toBe('/assets/hackathon/items/mouse-quebrado.png');
  });
});

describe('monitor numbers', () => {
  it('cracks the glass as the integrity falls, and shatters it when broken', () => {
    expect(crackLevel(1, false)).toBe(0);
    expect(crackLevel(0.75, false)).toBe(1);
    expect(crackLevel(0.5, false)).toBe(2);
    expect(crackLevel(0.2, false)).toBe(3);
    expect(crackLevel(0.9, true)).toBe(4);
  });

  it('colours the integrity by how little is left', () => {
    expect(integrityTone(0.9)).toBe('good');
    expect(integrityTone(0.4)).toBe('warn');
    expect(integrityTone(0.1)).toBe('bad');
  });

  it('shrinks the mobs as the wave grows', () => {
    expect(mobZoom(1)).toBeGreaterThan(mobZoom(3));
    expect(mobZoom(3)).toBeGreaterThan(mobZoom(6));
  });

  it('formats times and rates in pt-BR', () => {
    expect(seconds(23.46)).toBe('23,5 s');
    expect(seconds(-1)).toBe('0,0 s');
    expect(perSecond(0.4)).toBe('0,40');
    expect(perSecond(12.34)).toBe('12,3');
    expect(perSecond(250.2)).toBe('250');
  });
});

describe('the 9th slot', () => {
  it('says where the lab stands', () => {
    expect(entryCaption(entry({ unlocked: false }))).toBe('Trancado');
    expect(entryCaption(entry({ ok: false, reason: 'Faltam 5 aulas' }))).toBe('Faltam 5 aulas');
    expect(entryCaption(entry())).toBe('Iniciar pesquisa');
    expect(entryCaption(entry({ hasRun: true, status: 'fighting', phase: 7 }))).toBe('Fase 7');
    expect(entryCaption(entry({ hasRun: true, status: 'reward', phase: 7 }))).toBe('Fase 7: escolha');
    expect(entryCaption(entry({ hasRun: true, status: 'broken', phase: 7 }))).toBe('Monitor quebrado');
  });

  it('calls attention only when the player has something to do', () => {
    expect(entryNeedsAttention(entry())).toBe(true);
    expect(entryNeedsAttention(entry({ hasRun: true, status: 'reward' }))).toBe(true);
    expect(entryNeedsAttention(entry({ hasRun: true, status: 'fighting' }))).toBe(false);
    expect(entryNeedsAttention(entry({ ok: false }))).toBe(false);
    expect(entryNeedsAttention(entry({ unlocked: false }))).toBe(false);
  });
});

describe('records and feed', () => {
  it('lists the counters', () => {
    const counters = { ...createLabCounters(), phasesCleared: 1234, bossesBeaten: 3 };
    const records = recordSections(counters, 14, 200);
    expect(records.tiles[0]).toEqual({ label: 'Fase mais alta', value: '14' });
    const rows = records.sections.flatMap((section) => section.rows);
    expect(rows.find((row) => row.label === 'Fases vencidas')?.value).toBe('1.234');
    expect(rows.find((row) => row.label === 'Commits gastos na árvore')?.value).toBe('200');
    expect(recordSections(createLabCounters(), 0, 0).tiles[0]?.value).toBe('-');
  });

  it('hangs the nodes of a branch under their requirements', () => {
    const at = (id: string, requires: string[], row: number) => ({ id, requires, position: { row } });
    const forest = nodeForest([at('c', ['a'], 3), at('a', [], 0), at('b', ['a'], 2), at('d', ['b'], 4), at('x', ['elsewhere'], 5)]);
    expect(forest.map((entry) => entry.node.id)).toEqual(['a', 'x']);
    expect(forest[0]?.children.map((entry) => entry.node.id)).toEqual(['b', 'c']);
    expect(forest[0]?.children[0]?.children.map((entry) => entry.node.id)).toEqual(['d']);
  });

  it('covers every node of the real tree and keeps the branches apart', () => {
    for (const branch of ['codigo', 'infra', 'produto'] as const) {
      const nodes = content.lab.tree.filter((node) => node.branch === branch);
      const count = (list: ReturnType<typeof nodeForest<(typeof nodes)[number]>>): number => list.reduce((sum, entry) => sum + 1 + count(entry.children), 0);
      expect(count(nodeForest(nodes))).toBe(nodes.length);
    }
  });

  it('names where a node stands', () => {
    expect(nodeState({ maxed: true, available: true, affordable: false })).toBe('max');
    expect(nodeState({ maxed: false, available: false, affordable: true })).toBe('locked');
    expect(nodeState({ maxed: false, available: true, affordable: true })).toBe('ready');
    expect(nodeState({ maxed: false, available: true, affordable: false })).toBe('short');
  });

  it('flashes a line for the events of the run and ignores the rest', () => {
    expect(feedText(content, { type: 'labPhaseCleared', phase: 4, boss: false })).toBe('Fase 4 concluída');
    expect(feedText(content, { type: 'labPhaseCleared', phase: 5, boss: true })).toBe('Chefão da fase 5 derrotado');
    expect(feedText(content, { type: 'labItemGained', item: 'mouse-quebrado', rarity: 'raro', equipped: true })).toBe(
      'Novo item: Mouse quebrado (raro)',
    );
    expect(feedText(content, { type: 'labUnlocked' })).toBeNull();
  });
});
