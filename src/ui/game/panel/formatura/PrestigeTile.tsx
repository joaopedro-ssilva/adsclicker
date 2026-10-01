import { memo } from 'react';
import type { PrestigeNodeDef } from '@/game/content/types';
import { Icon } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { TREE_COLS, TREE_ROWS } from './treeLayout';

export type TileState = 'maxed' | 'owned' | 'ready' | 'available' | 'locked';

interface PrestigeTileProps {
  node: PrestigeNodeDef;
  level: number;
  maxLevel: number;
  cost: number;
  state: TileState;
  selected: boolean;
  onSelect: (id: string) => void;
}

const STATE_LABEL: Record<TileState, string> = {
  maxed: 'nível máximo',
  owned: 'comprado',
  ready: 'pode comprar',
  available: 'disponível',
  locked: 'bloqueado',
};

/** One node of the tree, placed by its grid position. */
export const PrestigeTile = memo(function PrestigeTile({ node, level, maxLevel, cost, state, selected, onSelect }: PrestigeTileProps) {
  const style = cssVariables({
    '--col': String(node.position.col),
    '--row': String(node.position.row),
    '--cols': String(TREE_COLS),
    '--rows': String(TREE_ROWS),
  });
  return (
    <div className="prestige-slot" style={style}>
      <button
        type="button"
        className="prestige-tile"
        data-branch={node.branch}
        data-state={state}
        aria-pressed={selected}
        aria-label={`${node.name}, nível ${level} de ${maxLevel}, ${STATE_LABEL[state]}`}
        data-qa={`prestige-${node.id}`}
        onClick={() => onSelect(node.id)}
      >
        <span className="prestige-tile-emoji" aria-hidden="true">
          {node.emoji}
        </span>
        <span className="prestige-tile-level" aria-hidden="true">
          {state === 'maxed' ? 'MÁX' : `${level}/${maxLevel}`}
        </span>
        {state === 'locked' ? <Icon name="lock" size={12} className="prestige-tile-lock" /> : null}
      </button>
      {state !== 'maxed' ? (
        <span className="prestige-tile-cost" data-state={state} aria-hidden="true">
          <Icon name="diploma" size={12} />
          {cost}
        </span>
      ) : null}
    </div>
  );
});
