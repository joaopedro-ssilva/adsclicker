import type { PrestigeNodeDef } from '@/game/content/types';
import { useGame } from '@/game/store';
import type { PrestigeNodeView } from '@/game/store';
import { Badge, Button, Icon } from '@/ui/kit';
import { useReducedMotion } from '@/ui/ThemeProvider';
import { playLimited, shake } from '../lib/feedback';
import { BRANCH_LABELS, nodesById } from './treeLayout';

interface PrestigeDetailProps {
  node: PrestigeNodeDef;
  view: PrestigeNodeView;
}

/** Why a node cannot be bought, in words. */
function blocker(node: PrestigeNodeDef, view: PrestigeNodeView, diplomas: number): string | null {
  if (view.maxed) return 'Nível máximo';
  if (!view.available) {
    const missing = node.requires.map((id) => nodesById.get(id)?.name).filter(Boolean);
    return `Requer ${missing.join(' e ')}`;
  }
  if (diplomas < view.cost) return `Faltam ${view.cost - diplomas} ${view.cost - diplomas === 1 ? 'diploma' : 'diplomas'}`;
  return null;
}

/** The selected node: what it does, its level and cost, and the buy button. */
export function PrestigeDetail({ node, view }: PrestigeDetailProps) {
  const diplomas = useGame((store) => store.state.diplomas);
  const reduced = useReducedMotion();
  const reason = blocker(node, view, diplomas);

  const buy = (element: HTMLElement) => {
    const bought = useGame.getState().buyPrestigeNode(node.id);
    if (!bought) {
      playLimited('cantAfford', 120);
      shake(element, reduced);
    }
  };

  return (
    <div className="prestige-detail" data-branch={node.branch} aria-live="polite">
      <span className="prestige-detail-emoji" aria-hidden="true">
        {node.emoji}
      </span>
      <div className="prestige-detail-text">
        <div className="prestige-detail-title">
          <h3>{node.name}</h3>
          <Badge>{BRANCH_LABELS[node.branch]}</Badge>
        </div>
        <p>{node.description}</p>
        <p className="prestige-detail-level">
          Nível <strong>{view.level}</strong>/{view.maxLevel}
        </p>
      </div>
      <div className="prestige-detail-buy">
        <Button
          variant={reason === null ? 'primary' : 'secondary'}
          aria-disabled={reason !== null}
          data-qa={`buy-${node.id}`}
          onClick={(event) => buy(event.currentTarget)}
        >
          {view.maxed ? (
            <>
              <Icon name="check" size={12} />
              Completo
            </>
          ) : (
            <>
              Comprar
              <span className="prestige-cost">
                <Icon name="diploma" size={12} />
                {view.cost}
              </span>
            </>
          )}
        </Button>
        {reason && !view.maxed ? <p className="prestige-detail-reason">{reason}</p> : null}
      </div>
    </div>
  );
}
