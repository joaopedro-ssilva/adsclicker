import { content } from '@/game/content';
import type { PrestigeBranch, PrestigeNodeDef } from '@/game/content/types';

export const nodesById = new Map(content.prestigeNodes.map((node) => [node.id, node]));

/** Grid size of the tree, from the `position` of every node. */
export const TREE_COLS = Math.max(...content.prestigeNodes.map((node) => node.position.col)) + 1;
export const TREE_ROWS = Math.max(...content.prestigeNodes.map((node) => node.position.row)) + 1;

export interface TreeEdge {
  parent: PrestigeNodeDef;
  child: PrestigeNodeDef;
  /** Points in grid units, cell centres at (col + 0.5, row + 0.5). The route is vertical, horizontal, vertical. */
  points: string;
}

function route(parent: PrestigeNodeDef, child: PrestigeNodeDef): string {
  const px = parent.position.col + 0.5;
  const py = parent.position.row + 0.5;
  const cx = child.position.col + 0.5;
  const cy = child.position.row + 0.5;
  // Closer to the child than to the parent, so the elbow clears the cost label under the parent tile.
  const mid = py + (cy - py) * 0.62;
  return `${px},${py} ${px},${mid} ${cx},${mid} ${cx},${cy}`;
}

export const treeEdges: TreeEdge[] = content.prestigeNodes.flatMap((child) =>
  child.requires.flatMap((parentId) => {
    const parent = nodesById.get(parentId);
    return parent ? [{ parent, child, points: route(parent, child) }] : [];
  }),
);

export const BRANCH_LABELS: Record<PrestigeBranch, string> = {
  core: 'Tronco',
  click: 'Clique',
  idle: 'Produção',
  events: 'Eventos',
};
