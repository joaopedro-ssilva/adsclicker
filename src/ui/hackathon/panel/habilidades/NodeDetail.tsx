import type { Modifier } from '@/hackathon/content';
import { useHackathon } from '@/ui/hackathon/store';
import { Badge, Button, Icon } from '@/ui/kit';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';
import { skillById } from '../lib/hk';
import { affixView, BRANCH_LABEL } from '../lib/labels';
import type { NodeView } from './nodeState';

/** "+4 Lógica" for `levels` levels of a node's modifiers. */
function effectText(modifiers: Modifier[], levels: number): string {
  return modifiers.map((modifier) => {
    const view = affixView({ ...modifier, value: modifier.value * levels });
    return `${view.value} ${view.label}`;
  }).join(', ');
}

/** The selected node: what it gives now and at the next level, why it is locked, and the buy button. */
export function NodeDetail({ view }: { view: NodeView }) {
  const { node, level, state, lock } = view;
  const { locked: busy } = useBusy();
  const { run: report, error } = useAction();
  const skill = node.unlocksSkill ? skillById.get(node.unlocksSkill) : undefined;
  const maxed = state === 'maxed';
  const reason = maxed ? null : lock;
  const blocked = reason !== null || busy;

  return (
    <div className="hk-node-detail" data-branch={node.branch} aria-live="polite" data-qa="hk-node-detail">
      <span className="hk-node-detail-emoji" aria-hidden="true">
        {node.emoji}
      </span>
      <div className="hk-node-detail-text">
        <div className="hk-node-detail-title">
          <h3>{node.name}</h3>
          <Badge>{BRANCH_LABEL[node.branch]}</Badge>
        </div>
        <p className="hk-note">{node.description}</p>
        <p className="hk-node-detail-level">
          Nível <strong>{level}</strong>/{node.maxLevel} · custa {node.cost} {node.cost === 1 ? 'ponto' : 'pontos'}
        </p>
        {node.modifiers.length > 0 ? (
          <p className="hk-node-detail-effect">
            {level > 0 ? <span>Agora: {effectText(node.modifiers, level)}. </span> : null}
            {!maxed ? <span data-next="true">Próximo nível: {effectText(node.modifiers, 1)}.</span> : null}
          </p>
        ) : null}
        {skill ? (
          <p className="hk-node-detail-effect">
            <span>
              {skill.emoji} {skill.name}: {skill.description}
            </span>
          </p>
        ) : null}
      </div>
      <div className="hk-node-detail-buy">
        <Button
          variant={blocked || maxed ? 'secondary' : 'primary'}
          aria-disabled={blocked}
          data-qa="hk-node-buy"
          onClick={() => {
            if (blocked || maxed) return;
            void report(useHackathon.getState().buyNode(node.id));
          }}
        >
          {maxed ? (
            <>
              <Icon name="check" size={12} />
              Completo
            </>
          ) : (
            <>Comprar</>
          )}
        </Button>
        {reason ? <p className="hk-reason">{reason}</p> : null}
        <InlineError message={error} />
      </div>
    </div>
  );
}
