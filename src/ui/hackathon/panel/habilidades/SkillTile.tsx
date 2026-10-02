import { memo } from 'react';
import { Icon } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import type { SkillNodeDef } from '@/hackathon/content';
import type { NodeState } from './nodeState';
import { TREE_COLS, TREE_ROWS } from './treeLayout';

interface SkillTileProps {
  node: SkillNodeDef;
  level: number;
  state: NodeState;
  selected: boolean;
  onSelect: (id: string) => void;
}

const STATE_LABEL: Record<NodeState, string> = {
  maxed: 'nível máximo',
  ready: 'pode comprar',
  owned: 'comprada',
  available: 'faltam pontos',
  locked: 'bloqueada',
};

/** One node of the tree, placed by its grid position. */
export const SkillTile = memo(function SkillTile({ node, level, state, selected, onSelect }: SkillTileProps) {
  const style = cssVariables({
    '--col': String(node.position.col),
    '--row': String(node.position.row),
    '--cols': String(TREE_COLS),
    '--rows': String(TREE_ROWS),
  });
  return (
    <div className="hk-node-slot" style={style}>
      <button
        type="button"
        className="hk-node"
        data-branch={node.branch}
        data-state={state}
        aria-pressed={selected}
        aria-label={`${node.name}, nível ${level} de ${node.maxLevel}, ${STATE_LABEL[state]}`}
        data-qa={`hk-node-${node.id}`}
        onClick={() => onSelect(node.id)}
      >
        <span className="hk-node-emoji" aria-hidden="true">
          {node.emoji}
        </span>
        <span className="hk-node-level" aria-hidden="true">
          {state === 'maxed' ? 'MÁX' : `${level}/${node.maxLevel}`}
        </span>
        {state === 'locked' ? <Icon name="lock" size={12} className="hk-node-lock" /> : null}
        {node.unlocksSkill ? (
          <span className="hk-node-active" aria-hidden="true" title="Libera uma habilidade ativa">
            ★
          </span>
        ) : null}
      </button>
      <span className="hk-node-name" data-state={state} aria-hidden="true">
        {node.name}
      </span>
    </div>
  );
});
