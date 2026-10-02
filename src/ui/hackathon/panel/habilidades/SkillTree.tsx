import { cssVariables } from '@/ui/theme';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';
import { BRANCH_LABEL } from '../lib/labels';
import { nodeView } from './nodeState';
import { SkillTile } from './SkillTile';
import { BRANCH_COLUMNS, TREE_COLS, TREE_ROWS, treeEdges } from './treeLayout';

interface SkillTreeProps {
  profile: HackathonProfile;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** The skill tree drawn on the grid positions of its nodes, three branches side by side. It scales, so it never scrolls sideways. */
export function SkillTree({ profile, selectedId, onSelect }: SkillTreeProps) {
  const views = new Map(HK.skillNodes.map((node) => [node.id, nodeView(node, profile)]));
  return (
    <div className="hk-tree">
      <div className="hk-tree-heads" style={cssVariables({ '--cols': String(TREE_COLS) })}>
        {BRANCH_COLUMNS.map(({ branch }) => (
          <span key={branch} data-branch={branch}>
            {BRANCH_LABEL[branch]}
          </span>
        ))}
      </div>
      <div className="hk-tree-board" style={cssVariables({ '--cols': String(TREE_COLS), '--rows': String(TREE_ROWS) })}>
        <svg className="hk-tree-edges" viewBox={`0 0 ${TREE_COLS} ${TREE_ROWS}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
          {treeEdges.map((edge) => {
            const reached = (views.get(edge.parent.id)?.level ?? 0) > 0;
            const taken = reached && (views.get(edge.child.id)?.level ?? 0) > 0;
            return (
              <polyline
                key={`${edge.parent.id}>${edge.child.id}`}
                points={edge.points}
                data-branch={edge.child.branch}
                data-edge={taken ? 'taken' : reached ? 'open' : 'closed'}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {HK.skillNodes.map((node) => {
          const view = views.get(node.id);
          if (!view) return null;
          return <SkillTile key={node.id} node={node} level={view.level} state={view.state} selected={node.id === selectedId} onSelect={onSelect} />;
        })}
      </div>
    </div>
  );
}
