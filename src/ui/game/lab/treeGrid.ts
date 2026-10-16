import type { LabNodeView } from '@/game/engine/views';

/** The tree of one branch on a small grid: the same idea as the diploma tree (cell centres, vertical-horizontal-vertical links). */
export interface BranchGrid<T extends GridNode> {
  cols: number;
  rows: number;
  nodes: (T & { col: number; row: number })[];
  /** Links parent -> child inside the branch, as SVG points in cell units. */
  edges: { parent: string; child: string; points: string }[];
}

type GridNode = Pick<LabNodeView, 'id' | 'requires' | 'position'>;

export function branchGrid<T extends GridNode>(nodes: readonly T[]): BranchGrid<T> {
  const minCol = Math.min(...nodes.map((node) => node.position.col));
  const placed = nodes.map((node) => ({ ...node, col: node.position.col - minCol, row: node.position.row }));
  const byId = new Map(placed.map((node) => [node.id, node]));
  const edges = placed.flatMap((child) =>
    child.requires.flatMap((id) => {
      const parent = byId.get(id);
      if (!parent) return [];
      const py = parent.row + 0.5;
      const cy = child.row + 0.5;
      const mid = py + (cy - py) * 0.5;
      return [{ parent: parent.id, child: child.id, points: `${parent.col + 0.5},${py} ${parent.col + 0.5},${mid} ${child.col + 0.5},${mid} ${child.col + 0.5},${cy}` }];
    }),
  );
  return {
    cols: Math.max(...placed.map((node) => node.col)) + 1,
    rows: Math.max(...placed.map((node) => node.row)) + 1,
    nodes: placed,
    edges,
  };
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/** The node nearest to `from` in a direction (arrow keys), or null. Looks at every node of the branch. */
export function neighbour<T extends { id: string; col: number; row: number }>(nodes: readonly T[], from: string, direction: Direction): T | null {
  const origin = nodes.find((node) => node.id === from);
  if (!origin) return null;
  let best: T | null = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    if (node.id === from) continue;
    const dx = node.col - origin.col;
    const dy = node.row - origin.row;
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    if (along <= 0) continue;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}
