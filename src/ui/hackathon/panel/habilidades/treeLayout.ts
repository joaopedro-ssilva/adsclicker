import type { SkillNodeDef } from '@/hackathon/content';
import { HK, nodeById } from '../lib/hk';

export const TREE_COLS = Math.max(...HK.skillNodes.map((node) => node.position.col)) + 1;
export const TREE_ROWS = Math.max(...HK.skillNodes.map((node) => node.position.row)) + 1;

export interface TreeEdge {
  parent: SkillNodeDef;
  child: SkillNodeDef;
  /** Points in grid units, cell centres at (col + 0.5, row + 0.5): down, across, down. */
  points: string;
}

function route(parent: SkillNodeDef, child: SkillNodeDef): string {
  const px = parent.position.col + 0.5;
  const py = parent.position.row + 0.5;
  const cx = child.position.col + 0.5;
  const cy = child.position.row + 0.5;
  const mid = py + (cy - py) * 0.5;
  return `${px},${py} ${px},${mid} ${cx},${mid} ${cx},${cy}`;
}

export const treeEdges: TreeEdge[] = HK.skillNodes.flatMap((child) =>
  child.requires.flatMap((parentId) => {
    const parent = nodeById.get(parentId);
    return parent ? [{ parent, child, points: route(parent, child) }] : [];
  }),
);

/** One column per branch, in the order the grid places them. */
export const BRANCH_COLUMNS: { branch: SkillNodeDef['branch']; col: number }[] = [
  ...new Map(HK.skillNodes.map((node) => [node.branch, { branch: node.branch, col: node.position.col }])).values(),
].sort((a, b) => a.col - b.col);
