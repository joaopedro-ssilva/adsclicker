import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { branchGrid, neighbour } from './treeGrid';

const nodes = content.lab.tree.map((node) => ({ id: node.id, branch: node.branch, requires: node.requires, position: node.position }));

describe('tree grid', () => {
  it('fits every branch on a small grid with no two tiles on one cell', () => {
    for (const branch of ['codigo', 'infra', 'produto'] as const) {
      const grid = branchGrid(nodes.filter((node) => node.branch === branch));
      expect(grid.cols).toBeLessThanOrEqual(4);
      expect(grid.rows).toBeLessThanOrEqual(5);
      expect(new Set(grid.nodes.map((node) => `${node.col},${node.row}`)).size).toBe(grid.nodes.length);
      // only links inside the branch are drawn
      for (const edge of grid.edges) expect(grid.nodes.some((node) => node.id === edge.parent)).toBe(true);
    }
  });

  it('moves between tiles with the arrow keys', () => {
    const grid = branchGrid(nodes.filter((node) => node.branch === 'codigo'));
    expect(neighbour(grid.nodes, 'algoritmos-eficientes', 'down')?.row).toBe(1);
    expect(neighbour(grid.nodes, 'algoritmos-eficientes', 'up')).toBeNull();
    expect(neighbour(grid.nodes, 'estudo-de-chefao', 'right')?.id).toBe('setup-de-casa');
  });
});
