import { useState } from 'react';
import { content, usePrestigeNodeViews } from '@/game/store';
import type { PrestigeNodeView } from '@/game/store';
import { cssVariables } from '@/ui/theme';
import { PrestigeDetail } from './PrestigeDetail';
import { PrestigeTile, type TileState } from './PrestigeTile';
import { nodesById, TREE_COLS, TREE_ROWS, treeEdges } from './treeLayout';

function tileState(view: PrestigeNodeView): TileState {
  if (view.maxed) return 'maxed';
  if (view.level > 0 && !view.affordable) return 'owned';
  if (view.affordable) return 'ready';
  return view.available ? 'available' : 'locked';
}

/** The permanent tree, drawn on the grid positions of its nodes. It scales with the panel, so it never scrolls sideways. */
export function PrestigeTree() {
  const views = usePrestigeNodeViews();
  const [picked, setPicked] = useState<string | null>(null);

  const byId = new Map(views.map((view) => [view.id, view]));
  const fallback = views.find((view) => view.affordable) ?? views[0];
  const selectedId = picked && byId.has(picked) ? picked : fallback?.id;
  const selectedView = selectedId ? byId.get(selectedId) : undefined;
  const selectedNode = selectedId ? nodesById.get(selectedId) : undefined;

  return (
    <div className="prestige">
      <div className="prestige-board" style={cssVariables({ '--cols': String(TREE_COLS), '--rows': String(TREE_ROWS) })}>
        <svg
          className="prestige-edges"
          viewBox={`0 0 ${TREE_COLS} ${TREE_ROWS}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          {treeEdges.map((edge) => {
            const reached = (byId.get(edge.parent.id)?.level ?? 0) > 0;
            const taken = reached && (byId.get(edge.child.id)?.level ?? 0) > 0;
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
        {content.prestigeNodes.map((node) => {
          const view = byId.get(node.id);
          if (!view) return null;
          return (
            <PrestigeTile
              key={node.id}
              node={node}
              level={view.level}
              maxLevel={view.maxLevel}
              cost={view.cost}
              state={tileState(view)}
              selected={node.id === selectedId}
              onSelect={setPicked}
            />
          );
        })}
      </div>

      {selectedNode && selectedView ? <PrestigeDetail node={selectedNode} view={selectedView} /> : null}
    </div>
  );
}
